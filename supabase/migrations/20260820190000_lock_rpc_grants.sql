-- ============================================================================
-- Dynasty — close the RPC surface to anonymous callers
--
-- Probing every RPC with the public anon key showed all of them executing.
-- `revoke execute ... from public` followed by `grant ... to authenticated`
-- reads like it restricts them, and does not: Supabase's schema defaults grant
-- EXECUTE on public functions to `anon` and `authenticated` directly, and a
-- revoke aimed at PUBLIC never touches those.
--
-- Nothing was exploitable, because each function checks auth.uid() (or
-- is_family_creator) itself before doing anything. That is the layer that has
-- been holding. This migration restores the layer that was supposed to be in
-- front of it, so the next RPC someone adds isn't exposed to the internet the
-- moment it forgets an internal check.
-- ============================================================================

-- ── 1. Remove the superseded code-based invite functions ────────────────────
--
-- peek_invite() answered "is this code real?" to anyone, unauthenticated,
-- unlimited, with no log — the oracle that made the old four-character codes
-- worth guessing. Person invites replaced both of these and no code path calls
-- them any more. Dead code with a known weakness is worse than no code.
--
-- The `invites` table is left in place; it still holds history.

drop function if exists public.peek_invite(text);
drop function if exists public.accept_invite(text);

-- ── 2. Take anon off everything it has no business calling ──────────────────
--
-- All of these already refuse an anonymous caller on their own. Revoking is
-- belt and braces, and it makes the intent readable in the schema instead of
-- buried in each function body.

revoke execute on function public.create_family(text)                          from anon;
revoke execute on function public.claim_person(uuid)                           from anon;
revoke execute on function public.remove_member(uuid, uuid)                    from anon;
revoke execute on function public.add_children(uuid, uuid[], jsonb)            from anon;
revoke execute on function public.set_reaction(uuid, confirmation_type)        from anon;
revoke execute on function public.create_person_invite(uuid, integer)          from anon;
revoke execute on function public.accept_person_invite(text, text, date, text) from anon;

-- peek_person_invite stays callable by anon on purpose: someone following an
-- invite link has to see who invited them and to what before they are asked to
-- create an account. It is safe to expose because the token is 128 bits from
-- gen_random_bytes — there is nothing to enumerate — and it returns only the
-- family name, the person's name and who sent it.

-- ── 3. The RLS helpers are deliberately left alone ──────────────────────────
--
-- is_family_member(), is_family_creator() and shares_family_with() are called
-- from inside the row-level security policies themselves, and a policy
-- expression is evaluated with the querying role's privileges. Revoking
-- EXECUTE from `authenticated` would not tighten anything — it would stop
-- every policy in the schema from evaluating. They return only a boolean about
-- the caller's own membership and leak nothing about anyone else.
