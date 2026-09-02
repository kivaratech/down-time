import { Router, type IRouter } from "express";

const router: IRouter = Router();

// Plain-English privacy policy hosted at /privacy. Required by Google Play
// Console and Apple App Store Connect (both reviewers click the link to
// verify it loads as a real, readable policy at submission time).
//
// Updates: bump LAST_UPDATED and edit the body when our data practices
// change. If we ever stand up kivaratech.com or another marketing domain,
// the Play / App Store listing URL can be swapped without touching this
// file — the policy itself remains the same.
const LAST_UPDATED = "2026-05-30";

const PRIVACY_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>DownTime Privacy Policy</title>
  <style>
    :root {
      --primary: #0F3460;
      --text: #0D1B2A;
      --text-secondary: #5C6B82;
      --border: #E4E8EF;
      --bg: #F8F9FB;
      --surface: #FFFFFF;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
    }
    .container {
      max-width: 760px;
      margin: 0 auto;
      padding: 32px 20px 80px;
    }
    header {
      background: var(--primary);
      color: #fff;
      padding: 48px 20px 32px;
      text-align: center;
    }
    header h1 {
      margin: 0 0 8px;
      font-size: 28px;
      font-weight: 700;
      letter-spacing: -0.5px;
    }
    header p {
      margin: 0;
      opacity: 0.8;
      font-size: 14px;
    }
    main {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 32px 28px;
      margin-top: -24px;
    }
    h2 {
      font-size: 19px;
      margin: 28px 0 10px;
      color: var(--primary);
    }
    h2:first-of-type { margin-top: 0; }
    p, ul { margin: 0 0 12px; }
    ul { padding-left: 22px; }
    li { margin-bottom: 6px; }
    a {
      color: var(--primary);
      text-decoration: underline;
    }
    .muted {
      color: var(--text-secondary);
      font-size: 14px;
    }
    .updated {
      display: inline-block;
      background: rgba(15,52,96,0.08);
      color: var(--primary);
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 16px;
    }
    code {
      background: rgba(15,52,96,0.08);
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 90%;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --text: #E8ECF2;
        --text-secondary: #9BAABB;
        --border: #2A3445;
        --bg: #0D1B2A;
        --surface: #131F33;
      }
    }
  </style>
</head>
<body>
  <header>
    <h1>DownTime Privacy Policy</h1>
    <p>How Kivara Tech handles your data in the DownTime app</p>
  </header>
  <div class="container">
    <main>
      <span class="updated">Last updated: ${LAST_UPDATED}</span>

      <h2>About this policy</h2>
      <p>
        DownTime is a restaurant equipment issue tracking app operated by
        Kivara Tech ("we," "us," "our"). Restaurant chains use DownTime to
        report broken or malfunctioning equipment from in-store tablets and
        to coordinate fixes through supervisors and admins.
      </p>
      <p>
        This policy explains what data we collect when you use DownTime,
        how we use it, where it's stored, and your rights regarding it.
      </p>

      <h2>What we collect</h2>
      <p>We collect only the data needed to operate the service:</p>
      <ul>
        <li>
          <strong>Account information:</strong> email address (used as your
          login), display name, and role (admin / supervisor / restaurant
          device), provided when an organization admin or platform
          super-admin creates the account.
        </li>
        <li>
          <strong>Authentication credentials:</strong> passwords are stored
          only as one-way salted hashes (PBKDF2-SHA512); we never store or
          have access to the plaintext.
        </li>
        <li>
          <strong>Issue reports:</strong> text descriptions of equipment
          problems, the affected restaurant and equipment item, and
          optionally a photo, all created by users while using the app.
        </li>
        <li>
          <strong>Push notification tokens:</strong> when you opt in to
          notifications, the operating system gives us a token that lets us
          deliver a notification to your specific device. Tokens are per
          device, so a supervisor using both a phone and a tablet receives
          notifications on both.
        </li>
        <li>
          <strong>Organizational metadata:</strong> the restaurants, users,
          equipment lists, and issue history that belong to your organization.
        </li>
        <li>
          <strong>Server logs:</strong> standard web server logs (IP address,
          request method, timestamp, response code) used for debugging and
          security. Retained briefly and not associated with your account.
        </li>
      </ul>

      <h2>What we do not collect</h2>
      <ul>
        <li>Precise device location</li>
        <li>Contacts, calendars, microphone, or biometric data</li>
        <li>Advertising identifiers</li>
        <li>Browsing history or behavior on other apps or websites</li>
        <li>Third-party analytics (we run no Mixpanel, Google Analytics, Facebook SDK, or similar)</li>
      </ul>

      <h2>How we use your data</h2>
      <p>We use the data we collect only to:</p>
      <ul>
        <li>Operate the DownTime service and the features described above</li>
        <li>Deliver push notifications about issues to the right supervisors and admins in your organization</li>
        <li>Respond to support inquiries you send us</li>
        <li>Diagnose technical problems and improve reliability</li>
        <li>Comply with legal obligations if required</li>
      </ul>
      <p>
        We do not sell your data, share it for advertising, or use it to
        train machine learning models.
      </p>

      <h2>Where your data is stored</h2>
      <p>
        Your data is stored with the following service providers, each of
        which acts as a data processor on our behalf:
      </p>
      <ul>
        <li>
          <strong>Neon</strong> (PostgreSQL database) &mdash; account data,
          organizations, restaurants, issues, comments, equipment lists.
        </li>
        <li>
          <strong>Railway</strong> (application server hosting) &mdash;
          runs the DownTime API.
        </li>
        <li>
          <strong>Google Cloud Storage</strong> &mdash; photos attached to
          issues, scoped to your organization's storage prefix.
        </li>
        <li>
          <strong>Expo</strong> (push delivery) &mdash; forwards push
          notifications to Apple's APNs and Google's FCM for delivery to
          your device.
        </li>
      </ul>
      <p>
        All data in transit is encrypted with TLS. Data at rest is
        encrypted by the underlying providers.
      </p>

      <h2>How long we keep it</h2>
      <p>
        We retain organizational data (users, restaurants, issues, photos)
        for as long as your organization is using DownTime. There are two
        kinds of deletion that remove your data sooner:
      </p>
      <ul>
        <li>
          <strong>Per-issue deletion.</strong> When an admin deletes an
          individual issue from within the app, that issue's record is
          removed from our database and its attached photo (if any) is
          removed from our object storage at the same time.
        </li>
        <li>
          <strong>Organization deletion.</strong> When a super-admin
          deletes an organization, all of its data &mdash; users,
          restaurants, issues, comments, photos, sessions, and push
          tokens &mdash; is removed from our database and storage.
        </li>
      </ul>
      <p>
        Server logs are retained for a short rolling window for
        operational and security purposes (no more than 30 days).
      </p>

      <h2>Who can access your data</h2>
      <ul>
        <li>
          <strong>Other users in your organization</strong> can see data
          appropriate to their role. Admins see all issues, restaurants,
          and users in their organization. Supervisors see issues from
          restaurants they're assigned to. Restaurant devices can only
          report new issues; they can't see other restaurants' data.
        </li>
        <li>
          <strong>Kivara Tech (us)</strong> may access organizational data
          for debugging, customer support, or to enforce these terms. We
          minimize this access and don't read user data routinely.
        </li>
        <li>
          <strong>We do not share data with other organizations</strong>
          using DownTime. Tenant isolation is enforced in the database
          and at every API endpoint.
        </li>
        <li>
          <strong>Service providers</strong> listed under "Where your data
          is stored" process data on our behalf under their own privacy
          terms. We do not authorize them to use your data for their own
          purposes.
        </li>
      </ul>

      <h2>Your rights</h2>
      <p>You have the right to:</p>
      <ul>
        <li>Access the data we hold about you</li>
        <li>Correct inaccurate or incomplete data</li>
        <li>Request deletion of your account and associated data</li>
        <li>Object to or restrict certain uses</li>
      </ul>
      <p>
        For account-level changes, the fastest path is to ask your
        organization's admin (they can edit, deactivate, or reset
        passwords from inside the app). For everything else, or if you
        no longer have an active account, email us at
        <a href="mailto:kivara.tech@gmail.com">kivara.tech@gmail.com</a>
        and we'll respond within 30 days.
      </p>

      <h2>Children</h2>
      <p>
        DownTime is a workplace tool intended for adult employees of
        restaurant businesses. It is not directed at children under 13,
        and we do not knowingly collect data from anyone under 13. If
        you believe a child has provided us data, contact us and we will
        remove it.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        We may update this policy as the service evolves. Material changes
        will be reflected in the "Last updated" date at the top. Continued
        use of DownTime after changes take effect constitutes acceptance.
      </p>

      <h2>Contact</h2>
      <p>
        Questions, requests, or concerns about this policy or your data:
      </p>
      <p>
        <strong>Kivara Tech</strong><br />
        <a href="mailto:kivara.tech@gmail.com">kivara.tech@gmail.com</a>
      </p>

      <p class="muted" style="margin-top: 32px;">
        DownTime is a product of Kivara Tech. This policy applies to the
        DownTime mobile app and its backend services.
      </p>
    </main>
  </div>
</body>
</html>`;

router.get("/privacy", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  // Cache for an hour at the edge so the App Store / Play Store reviewer
  // bots don't hammer the route, but no longer than that — easy to deploy
  // policy updates.
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.send(PRIVACY_HTML);
});

// Dedicated data-deletion instructions, separate from the privacy policy.
// Google Play Console asks for a specific URL with prominent deletion steps,
// app/developer name reference, and explicit data-type breakdown of what's
// deleted vs kept. Reviewers click this URL from the Play listing.
const DATA_DELETION_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>DownTime — Request Account & Data Deletion</title>
  <style>
    :root {
      --primary: #0F3460;
      --accent: #E63946;
      --text: #0D1B2A;
      --text-secondary: #5C6B82;
      --border: #E4E8EF;
      --bg: #F8F9FB;
      --surface: #FFFFFF;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
    }
    .container {
      max-width: 760px;
      margin: 0 auto;
      padding: 32px 20px 80px;
    }
    header {
      background: var(--primary);
      color: #fff;
      padding: 48px 20px 32px;
      text-align: center;
    }
    header h1 {
      margin: 0 0 8px;
      font-size: 26px;
      font-weight: 700;
      letter-spacing: -0.5px;
    }
    header p {
      margin: 0;
      opacity: 0.85;
      font-size: 14px;
    }
    main {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 32px 28px;
      margin-top: -24px;
    }
    h2 {
      font-size: 19px;
      margin: 28px 0 10px;
      color: var(--primary);
    }
    h2:first-of-type { margin-top: 0; }
    p, ul, ol { margin: 0 0 12px; }
    ul, ol { padding-left: 22px; }
    li { margin-bottom: 6px; }
    a {
      color: var(--primary);
      text-decoration: underline;
    }
    .step {
      background: var(--bg);
      border-left: 3px solid var(--primary);
      padding: 14px 18px;
      margin-bottom: 12px;
      border-radius: 0 6px 6px 0;
    }
    .step strong { color: var(--primary); display: block; margin-bottom: 4px; }
    .mailto-pill {
      display: inline-block;
      background: var(--primary);
      color: #fff;
      padding: 10px 20px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      margin: 8px 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0;
      font-size: 14px;
    }
    th, td {
      text-align: left;
      padding: 10px 12px;
      border-bottom: 1px solid var(--border);
    }
    th { background: var(--bg); font-weight: 600; }
    .muted {
      color: var(--text-secondary);
      font-size: 14px;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --text: #E8ECF2;
        --text-secondary: #9BAABB;
        --border: #2A3445;
        --bg: #0D1B2A;
        --surface: #131F33;
      }
    }
  </style>
</head>
<body>
  <header>
    <h1>Request Account &amp; Data Deletion</h1>
    <p>For users of DownTime by Kivara Tech</p>
  </header>
  <div class="container">
    <main>
      <h2>About this page</h2>
      <p>
        DownTime is a restaurant equipment issue tracking app published by
        Kivara Tech. This page explains how to request deletion of your
        DownTime account and the data associated with it. For complete
        details on what we collect and how we handle data, see our
        <a href="/privacy">Privacy Policy</a>.
      </p>

      <h2>How to request deletion</h2>
      <p>Choose whichever path matches your situation:</p>

      <div class="step">
        <strong>Option A: Ask your organization's admin (fastest)</strong>
        If you're an active user, your organization's DownTime admin can
        deactivate your account or reset your password from inside the
        app's user management screen. This stops your access immediately.
        Ask them directly — no email needed.
      </div>

      <div class="step">
        <strong>Option B: Email Kivara Tech (for full deletion)</strong>
        Send an email to the address below from the email tied to your
        account (or describe your account clearly enough that we can
        identify it) and we will permanently delete your user record and
        all associated data within 30 days. Include the subject line
        "DownTime data deletion request."
      </div>

      <p style="text-align: center;">
        <a href="mailto:kivara.tech@gmail.com?subject=DownTime%20data%20deletion%20request" class="mailto-pill">
          kivara.tech@gmail.com
        </a>
      </p>

      <div class="step">
        <strong>Option C: Delete your entire organization (admins only)</strong>
        If you are a super-admin or org admin and want to remove your
        organization entirely from DownTime, email us at the address above
        and we'll fully delete the organization, all of its users, all
        restaurants, all issues, all comments, and all uploaded photos in
        one cascading deletion.
      </div>

      <h2>What gets deleted</h2>
      <p>When you request deletion of your individual account:</p>
      <table>
        <thead>
          <tr><th>Data type</th><th>Deleted?</th></tr>
        </thead>
        <tbody>
          <tr><td>Your email, display name</td><td>Yes — permanently</td></tr>
          <tr><td>Your password hash</td><td>Yes — permanently</td></tr>
          <tr><td>Your push notification tokens</td><td>Yes — permanently</td></tr>
          <tr><td>Your active sessions</td><td>Yes — immediately revoked</td></tr>
          <tr><td>Your restaurant assignments</td><td>Yes — permanently</td></tr>
          <tr><td>Issues you created</td><td>Retained but the author field is anonymised</td></tr>
          <tr><td>Comments you posted</td><td>Retained but anonymised</td></tr>
        </tbody>
      </table>

      <p class="muted">
        Why anonymise rather than delete issues and comments? Issues are
        organizational records of equipment problems that other people
        in your organization rely on (history of what was reported, how
        it was resolved). Deleting them would leave gaps in your
        organization's maintenance history. Removing your name from them
        protects your identity while preserving the underlying
        operational record.
      </p>

      <p>When an entire organization is deleted:</p>
      <table>
        <thead>
          <tr><th>Data type</th><th>Deleted?</th></tr>
        </thead>
        <tbody>
          <tr><td>All users in the organization</td><td>Yes — permanently</td></tr>
          <tr><td>All restaurants</td><td>Yes — permanently</td></tr>
          <tr><td>All issues and comments</td><td>Yes — permanently</td></tr>
          <tr><td>All photos uploaded to issues</td><td>Yes — permanently</td></tr>
          <tr><td>All push notification tokens</td><td>Yes — permanently</td></tr>
          <tr><td>All sessions and pairing codes</td><td>Yes — permanently</td></tr>
        </tbody>
      </table>

      <h2>What is kept (briefly)</h2>
      <ul>
        <li>
          <strong>Server logs</strong> covering the period including your
          request (IP, timestamps, request paths) are retained for a short
          rolling window for operational and security purposes — never
          longer than 30 days, and not associated with your identity once
          your account is deleted.
        </li>
        <li>
          <strong>Backup snapshots</strong> of our database may temporarily
          contain your data after deletion until the backups roll over.
          Backup retention is currently &le;14 days.
        </li>
      </ul>

      <h2>How long it takes</h2>
      <p>
        Account deactivations via your org admin are immediate. Full
        deletion requests sent to <a href="mailto:kivara.tech@gmail.com">kivara.tech@gmail.com</a>
        are processed within 30 days. We will reply confirming the
        deletion has been completed.
      </p>

      <h2>Contact</h2>
      <p>
        Kivara Tech &mdash;
        <a href="mailto:kivara.tech@gmail.com">kivara.tech@gmail.com</a>
      </p>
      <p class="muted">
        See also our full <a href="/privacy">Privacy Policy</a>.
      </p>
    </main>
  </div>
</body>
</html>`;

router.get("/data-deletion", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.send(DATA_DELETION_HTML);
});

// Public support page. App Store Connect requires a Support URL and will not
// accept a bare mailto: link, so this gives reviewers (and real customers) a
// genuine self-serve help page. It also documents the tablet pairing flow,
// which is the part reviewers most often get stuck on.
const SUPPORT_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>DownTime Support</title>
  <style>
    :root {
      --primary: #0F3460;
      --text: #0D1B2A;
      --text-secondary: #5C6B82;
      --border: #E4E8EF;
      --bg: #F8F9FB;
      --surface: #FFFFFF;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
    }
    .container {
      max-width: 760px;
      margin: 0 auto;
      padding: 32px 20px 80px;
    }
    header {
      background: var(--primary);
      color: #fff;
      padding: 48px 20px 32px;
      text-align: center;
    }
    header h1 {
      margin: 0 0 8px;
      font-size: 28px;
      font-weight: 700;
      letter-spacing: -0.5px;
    }
    header p {
      margin: 0;
      opacity: 0.8;
      font-size: 14px;
    }
    main {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 32px 28px;
      margin-top: -24px;
    }
    h2 {
      font-size: 19px;
      margin: 28px 0 10px;
      color: var(--primary);
    }
    h2:first-of-type { margin-top: 0; }
    p, ul { margin: 0 0 12px; }
    ul { padding-left: 22px; }
    li { margin-bottom: 6px; }
    a {
      color: var(--primary);
      text-decoration: underline;
    }
    .muted {
      color: var(--text-secondary);
      font-size: 14px;
    }
    .updated {
      display: inline-block;
      background: rgba(15,52,96,0.08);
      color: var(--primary);
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 16px;
    }
    code {
      background: rgba(15,52,96,0.08);
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 90%;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --text: #E8ECF2;
        --text-secondary: #9BAABB;
        --border: #2A3445;
        --bg: #0D1B2A;
        --surface: #131F33;
      }
    }
  </style>
</head>
<body>
  <header>
    <h1>DownTime Support</h1>
    <p>Help with the DownTime restaurant equipment issue tracker</p>
  </header>
  <div class="container">
    <main>
      <h2>Contact us</h2>
      <p>
        The fastest way to get help is email. We reply to support requests
        within two business days.
      </p>
      <p>
        <strong>Kivara Tech</strong><br />
        <a href="mailto:kivara.tech@gmail.com?subject=DownTime%20support">kivara.tech@gmail.com</a>
      </p>

      <h2>Getting an account</h2>
      <p>
        DownTime accounts are created for you, not self-registered. If your
        restaurant group already uses DownTime, ask your organization admin
        to add you and they will send your login email and a temporary
        password. If your company is not set up on DownTime yet, email us and
        we will provision your organization.
      </p>

      <h2>Signing in</h2>
      <p>
        Supervisors and admins sign in with their email address and password
        on the <em>Supervisor</em> option of the login screen. If you have
        forgotten your password, your organization admin can reset it for you
        from the Users screen.
      </p>

      <h2>Pairing a restaurant tablet</h2>
      <p>
        Tablets mounted in a restaurant run in device mode, which does not
        require anyone to log in. To pair one:
      </p>
      <ul>
        <li>Sign in as a supervisor or admin on any device.</li>
        <li>Go to <strong>Settings</strong> &rarr; <strong>Device Pairing</strong>.</li>
        <li>Pick the restaurant and generate a six-character pairing code.</li>
        <li>
          On the tablet, choose <strong>Restaurant Tablet</strong> on the
          login screen and enter the code.
        </li>
      </ul>
      <p>
        Pairing codes expire fifteen minutes after they are generated. If the
        code stops working, simply generate a new one.
      </p>

      <h2>Reporting an issue</h2>
      <p>
        From a paired tablet or from the supervisor app, tap
        <strong>Report an Issue</strong>, choose the area and the piece of
        equipment, describe the problem, and optionally attach a photo from
        the camera or photo library. Supervisors assigned to that restaurant
        are notified straight away.
      </p>

      <h2>Notifications</h2>
      <p>
        Supervisors and admins receive push notifications for new issues and
        for comments on issues they follow. Notifications are filtered by
        your specialty, so equipment supervisors are not paged about
        technology issues and vice versa. If notifications are not arriving,
        check that they are enabled for DownTime in your device settings.
      </p>

      <h2>Privacy and your data</h2>
      <p>
        See our <a href="/privacy">Privacy Policy</a> for what we collect and
        how it is stored, or our
        <a href="/data-deletion">Data Deletion</a> page to request removal of
        your account and data.
      </p>

      <p class="muted" style="margin-top: 32px;">
        DownTime is a product of Kivara Tech.
      </p>
    </main>
  </div>
</body>
</html>`;

router.get("/support", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.send(SUPPORT_HTML);
});

export default router;
