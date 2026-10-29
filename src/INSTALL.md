# World Atlas v30 — Social inbox and attribution

## Install (from the newest v29 app + your existing moderation setup)

1. Back up your existing project and Supabase data.
2. Run `SETUP_SOCIAL.sql` **once** using the Supabase SQL Editor, as project owner. Look for `Atlas social upgrade ready`.
3. Replace `src/App.tsx` and `src/AuthGate.tsx` using these complete files.
4. Add three new files under `src/`: `SocialInbox.tsx`, `SocialInbox.css`, and `CreatorCredit.tsx`.
5. Leave all existing `App.css`, `FriendsPanel`, `LiveCommunity`, `ModerationPanel`, and `sharedAtlas.ts` files as they are.
6. Save, run `npm run build` and test in two browser sessions BEFORE commit or publish.

## What to test

- Two different accounts sign in; they get the **Inbox** button in their member header.
- New global-chat messages from another user increment the in-app notification badge (existing history isn't counted as new on first use).
- An incoming friend request appears in the notification summary; approve it via the existing **Friends** panel.
- Choose a friend in Inbox to exchange DMs. The newest 100 are retained for both accounts; messages beyond 100 discard the oldest.
- Unfriend through Friends: the conversation disappears and cannot be read from either account; there is NO unfriend notification.
- When viewing a land or organism record, see original `Created by @username`; edits by a different authorized member add `Last edited by @username`.
- Test Edit permission and moderator authorization using two accounts before publishing.

## Notes / limitations

- Notifications are **in-app**, not browser push notifications or email. Messages while the tab was closed are caught by polling on next opening; only the last 50 global messages are fetched.
- The creator name is resolved for shared Atlas records; separate Environmental Science extension records are not included here.
- DM limit is based on the most recent 100 messages across each friendship, not 100 per person.
- Conversation deletion is permanent when friendship is removed. Preserve backups for recovery if desired.
- Moderation can remove abusive Atlas creations, but DM reporting/blocking isn't yet implemented. Consider adding both before scaling to a large community.
- TypeScript JSX parse tested locally, but full `npm run build` and Supabase integration must be tested in your connected StackBlitz and Supabase environment.
