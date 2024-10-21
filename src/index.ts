import Mailer from "./mailer.ts";
import Planka from "./planka.ts";

// Main workflow
async function main() {
  Planka.initialize();
  const mailer: Mailer = new Mailer();

  try {
    const emails = await mailer.handleEmails();
    const result = await Planka.processCards(emails);
    await mailer.handleResults(result);
    console.log("Process completed successfully.");
  } catch (error) {
    console.error("An error occurred during the process:", error);
  }
}

// Execute main if this is the main module
if (import.meta.main) {
  void main();
}
