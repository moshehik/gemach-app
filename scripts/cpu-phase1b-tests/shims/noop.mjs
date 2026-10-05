// Stand-in for modules a route imports but the test never reaches (mailer, gemini, templates, catalog, attachment upload).
const noop = async () => ({});
export const sendSystemEmail = noop, postToMailer = noop, generateContent = noop, renderErrorReportEmailHtml = () => '', renderHumanRequestedEmailHtml = () => '',
  emailSubject = () => '', uploadAttachmentDataUrls = async (x) => x;
export default {};
