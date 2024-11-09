import './env';
import log4js from 'log4js';
import Mailer from './mailer';
import Planka from './planka';

const logger = log4js.getLogger('Main');
logger.level = process.env['LOG_LEVEL'] || 'info';

// Main workflow
async function main() {
  Planka.initialize();
  const mailer: Mailer = new Mailer();

  try {
    logger.info('Starting process...');
    const emails = await mailer.handleEmails();
    const result = await Planka.processCards(emails);
    await mailer.handleResults(result);
    logger.info('Accepted', result.filter((r) => r.state === 'ACCEPTED').length, 'cards');
    logger.info('Rejected', result.filter((r) => r.state === 'REJECTED').length, 'cards');
  } catch (error) {
    logger.error('An error occurred during the process:', error);
  } finally {
    logger.info('Process completed.');
  }
}

// Execute main if this is the main module
if (require.main === module) {
  void main();
}
