import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "What Dynasty stores, who can see it, and how to get it back or have it removed.",
};

const LAST_UPDATED = "20 August 2026";

export default function PrivacyPage() {
  return (
    <>
      <h1 className="font-display text-3xl font-semibold tracking-tight text-stone-900">
        Privacy Policy
      </h1>
      <p className="mt-2 text-sm text-stone-400">Last updated {LAST_UPDATED}</p>

      <p className="mt-6 text-stone-600">
        Dynasty is a private, shared space for a family&apos;s history. This page
        explains what we store, who can see it, and how to get it back or have it
        removed. It is written to be read, not to be skimmed past.
      </p>

      <h2>The short version</h2>
      <ul>
        <li>Your tree is visible only to members of that tree. There are no public trees.</li>
        <li>We do not sell your data, and we do not run advertising.</li>
        <li>
          A family tree contains information about other people — including
          people who never signed up. That is the part worth reading carefully.
        </li>
      </ul>

      <h2>What we collect</h2>
      <p>
        <strong>Your account.</strong> Your email address, a display name, and
        (optionally) a profile picture. Your password is handled by our
        authentication provider and is never visible to us.
      </p>
      <p>
        <strong>What you put in a tree.</strong> Names, birth and death dates,
        life status, gender, cities, schools, jobs, links, notes, comments, a
        profile picture per person, and optionally a recording of how a
        name is pronounced. Also the relationships between people, and who added
        or changed each of those things.
      </p>
      <p>
        <strong>Technical data.</strong> Standard server logs from our hosting and
        database providers, used to keep the service running and secure.
      </p>
      <p>
        We do not use advertising trackers or third-party analytics that follow
        you across other websites.
      </p>

      <h2>Information about other people</h2>
      <p>
        This is unusual about genealogy and we would rather be direct about it. A
        family tree is mostly information about people other than you: living
        relatives who have not signed up, and relatives who have died.
      </p>
      <p>
        When you add someone to a tree, you are recording personal information
        about a real person who has not agreed to anything. Please only add what
        that person would be comfortable with their family knowing, and remove
        anything they ask you to remove. If you are recording details about a
        child, be especially careful.
      </p>
      <p>
        If you are in someone&apos;s Dynasty tree and want your information
        changed or removed, you do not need an account to ask. Contact us at the
        address below and we will act on it, including where the person who added
        it disagrees.
      </p>

      <h2>Who can see your tree</h2>
      <p>
        Membership of a family is the entire privacy boundary. Someone who is a
        member of a tree can see everything in it and can add to it. Someone who
        is not a member cannot see any of it. This is enforced in the database
        itself, not only in the app.
      </p>
      <p>
        People join a tree by invite code. Anyone holding a valid code can join,
        so treat a code like a house key: send it to the people you mean to send
        it to, and no further. Codes expire and can be revoked.
      </p>

      <h2>Children</h2>
      <p>
        Dynasty is not intended for use by children. You must be 16 or older to
        create an account.
      </p>
      <p>
        Trees themselves routinely contain children, because families contain
        children. If you are a parent or guardian and want a child&apos;s details
        removed from a tree, contact us and we will remove them.
      </p>

      <h2>Where your data lives</h2>
      <p>
        Accounts, tree data, photographs and recordings are stored with{" "}
        <a href="https://supabase.com" target="_blank" rel="noopener noreferrer">
          Supabase
        </a>{" "}
        (database, authentication and file storage), and the application is hosted
        on{" "}
        <a href="https://vercel.com" target="_blank" rel="noopener noreferrer">
          Vercel
        </a>
        . Both operate infrastructure in the United States. Photographs and
        recordings are stored in private buckets and served through short-lived
        signed links rather than public URLs.
      </p>

      <h2>How long we keep it</h2>
      <p>
        Tree data is kept for as long as the tree exists, because that is the
        point of it — this is meant to outlast a phone. Deleted content is removed
        from the live service; backups holding it are retained for a limited
        period and then overwritten.
      </p>

      <h2>Your rights</h2>
      <p>
        Depending on where you live, you may have rights to access, correct,
        export or delete your personal information, and to object to how it is
        used. We honour these requests wherever you live, not only where they are
        legally required.
      </p>
      <p>
        You can see and correct most of your own information directly in the app.
        For a copy of your data, or to delete your account, contact us.
      </p>

      <h2>Changes</h2>
      <p>
        If this policy changes in a way that matters, we will say so in the app
        rather than quietly updating the date at the top.
      </p>

      <h2>Contact</h2>
      <p>
        Questions, corrections, or a request to be removed from a tree:{" "}
        <a href="mailto:privacy@trydynasty.app">privacy@trydynasty.app</a>.
      </p>
    </>
  );
}
