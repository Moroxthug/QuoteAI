// Importing this module registers every automation handler. app.ts imports
// it once at startup so `raiseAutomation` and the cron tick can dispatch.
import "./quoteAccepted";
import "./contractSigned";
import "./milestoneCompleted";
import "./leadFollowup";
import "./jobReviewRequest";
import "./quoteFollowup";
import "./invoicePaidQuickbooks";
import "./costConfirmedQuickbooks";
import "./webhookDispatch";
