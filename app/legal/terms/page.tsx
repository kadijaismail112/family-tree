import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms",
  description: "The agreement between you and Dynasty.",
};

const LAST_UPDATED = "20 August 2026";

export default function TermsPage() {
  return (
    <>
      <h1 className="font-display text-3xl font-semibold tracking-tight text-stone-900">
        Terms of Service
      </h1>
      <p className="mt-2 text-sm text-stone-400">Last updated {LAST_UPDATED}</p>

      <p className="mt-6 text-stone-600">
        These terms are the agreement between you and Dynasty. Using the service
        means accepting them.
      </p>

      <h2>Who can use Dynasty</h2>
      <p>
        You must be at least 16 years old to create an account. You are
        responsible for what happens under your account, including keeping your
        password to yourself.
      </p>

      <h2>Your trees and who else is in them</h2>
      <p>
        A family tree is shared by design. Every member of a tree can add people,
        draw connections, edit details and remove things. There is no
        per-person ownership of entries inside a tree — that is deliberate,
        because family history is something a family assembles together.
      </p>
      <p>
        What that means in practice: only invite people you trust with the whole
        tree. An invite code grants full access to everything in that family.
      </p>

      <h2>What you add about other people</h2>
      <p>
        You are responsible for the information you record about others. By adding
        someone to a tree you confirm that you have a legitimate family or
        personal connection to that information, and that you will remove it if
        they ask.
      </p>
      <p>Do not use Dynasty to:</p>
      <ul>
        <li>Record information about people you have no genuine connection to.</li>
        <li>Track, monitor, profile or locate someone.</li>
        <li>Publish anything intended to harass, defame or endanger a person.</li>
        <li>Upload material you have no right to share.</li>
        <li>
          Attempt to reach families you are not a member of, including by guessing
          invite codes, or otherwise probing the service&apos;s security.
        </li>
        <li>Build automated tools that scrape or bulk-download from the service.</li>
      </ul>

      <h2>Your content</h2>
      <p>
        What you add is yours. You grant us only the permission needed to run the
        service — storing your content, and showing it to the other members of
        your tree. We do not claim ownership of your family&apos;s history and we
        do not use it to train models.
      </p>

      <h2>Deletion is permanent</h2>
      <p>
        Removing a person, a connection or a photograph deletes it. Deleting a
        person also removes their connections and anything attached to them. We
        keep backups for operational recovery, but you should not rely on us to
        undo a deletion — treat it as final.
      </p>

      <h2>Availability</h2>
      <p>
        We work to keep Dynasty running and your data safe, but the service is
        provided as it is, without warranty. We cannot promise it will always be
        available or free of faults. Keep your own copy of anything irreplaceable.
      </p>

      <h2>Suspension</h2>
      <p>
        We may suspend or remove an account that breaks these terms, particularly
        where someone else&apos;s safety or privacy is at stake. Where we can, we
        will tell you why.
      </p>

      <h2>Liability</h2>
      <p>
        To the extent the law allows, Dynasty is not liable for indirect or
        consequential loss arising from your use of the service, including loss of
        data. Nothing here limits liability that cannot legally be limited.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these terms. If a change is significant we will tell you in
        the app before it takes effect.
      </p>

      <h2>Contact</h2>
      <p>
        <a href="mailto:support@trydynasty.app">support@trydynasty.app</a>. See
        also our <Link href="/legal/privacy">Privacy Policy</Link>.
      </p>
    </>
  );
}
