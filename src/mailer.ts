import { ImapFlow, Readable } from 'imapflow';
import { getLogger } from 'log4js';

export interface CardEmail {
  title: string;
  boardId: bigint;
  listId: bigint | null;
  uid: string;
  body?: string;
  date: Date | null;
}

/**
 * Extracts the Planka board ID from email headers.
 * @param {string} headers - The ema il headers as a string.
 * @returns {string | null} The extracted board ID, or null if not found.
 */
function extractPlankaBoardId(headers: string): string | null {
  const regex = /^X-Planka-Board-Id:\s*(\d+)$/m;
  const match = headers.match(regex);
  return match ? match[1] : null;
}

/**
 * Extracts the Planka list ID from email headers.
 * @param {string} headers - The email headers as a string.
 * @returns {string | null} The extracted list ID, or null if not found.
 */
function extractPlankaListId(headers: string): string | null {
  const regex = /^X-Planka-List-Id:\s*(\d+)$/m;
  const match = headers.match(regex);
  return match ? match[1] : null;
}

/**
 * Extracts the date from the email subject.
 * @param {string} subject - The email subject line.
 * @returns {Date | null} The extracted date, or null if not found.
 */
function extractDate(subject: string): Date | null {
  const datePattern = /(\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2})/;
  const match = subject.match(datePattern);

  if (match) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [_, day, month, year, hour, minute] = match;
    return new Date(`${year}-${month}-${day}T${hour}:${minute}:00`);
  } else {
    return null;
  }
}

/**
 * Converts a readable stream to a string.
 * @param {Readable} readable - The readable stream.
 * @returns {Promise<string>} The content of the stream as a string.
 */
const readableToString = async (readable: Readable): Promise<string> => {
  let result = '';

  for await (const chunk of readable) {
    result += chunk;
  }

  return result;
};

/**
 * Downloads the body of an email message.
 * @param {ImapFlow} client - The IMAP client.
 * @param {string} messageId - The ID of the email message.
 * @returns {Promise<string>} The email body as a string.
 */
const downloadEmailBody = async (client: ImapFlow, messageId: string): Promise<string> => {
  const { content } = await client.download(messageId, '1', { uid: true }); // part '1' is typically the plain text part
  return readableToString(content);
};

export default class Mailer {
  private readonly client: ImapFlow;
  private ROOT_PATH: string = process.env['IMAP_ROOT'] || 'API';

  private readonly logger = getLogger('Mailer');

  constructor() {
    this.logger.level = process.env['LOG_LEVEL'] || 'warn';
    this.client = new ImapFlow({
      host: process.env['IMAP_HOST'] || 'localhost',
      port: Number(process.env['IMAP_PORT'] || '993'),
      secure: true,
      logger: this.logger,
      auth: {
        user: process.env['IMAP_USERNAME'] || 'user',
        pass: process.env['IMAP_PASSWORD'],
      },
    });
  }

  /**
   * Handles all emails in the 'IN' mailbox and processes them into CardEmail objects.
   * @returns {Promise<CardEmail[]>} A list of CardEmail objects created from the emails.
   */
  public async handleEmails(): Promise<CardEmail[]> {
    await this.client.connect();
    const lock = await this.client.getMailboxLock(`${this.ROOT_PATH}/IN`);
    const rejected: string[] = [];
    const emails: CardEmail[] = [];

    try {
      for await (const message of this.client.fetch(
        {},
        {
          envelope: true,
          headers: true,
          flags: true,
        },
      )) {
        // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
        const headers = '' + message.headers;
        const plankaBoardId = extractPlankaBoardId(headers);
        const plankaListId = extractPlankaListId(headers);
        const date = extractDate(message.envelope.subject);

        if (!plankaBoardId) {
          rejected.unshift(String(message.uid));
          continue;
        }

        emails.unshift({
          boardId: BigInt(plankaBoardId),
          listId: plankaListId ? BigInt(plankaListId) : null,
          uid: String(message.uid),
          title: message.envelope.subject,
          date: date,
        });
      }

      for (const email of emails) {
        email.body = await downloadEmailBody(this.client, email.uid);
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      // noop
    } finally {
      lock.release();
    }

    if (rejected.length !== 0) {
      await this.client.mailboxOpen(`${this.ROOT_PATH}/IN`);
      await this.rejectEmail(rejected.join(',')).catch((e) => this.logger.error(e));
      await this.client.mailboxClose();
    }

    return emails;
  }

  /**
   * Handles the results of card processing by accepting or rejecting emails.
   * @param {Array<{card: CardEmail, state: 'ACCEPTED' | 'REJECTED'}>} results - List of cards and their states.
   */
  async handleResults(results: { card: CardEmail; state: 'ACCEPTED' | 'REJECTED' }[]) {
    await this.client.mailboxOpen(`${this.ROOT_PATH}/IN`);
    for (const result of results) {
      if (result.state === 'ACCEPTED') {
        this.logger.trace('accepted', result.card.uid);
        await this.acceptEmail(result.card.uid);
      } else {
        this.logger.trace('rejected', result.card.uid);
        await this.rejectEmail(result.card.uid);
      }
    }
    await this.client.mailboxClose();
    await this.client.logout();
  }

  /**
   * Moves an email to the 'REJECTED' mailbox.
   * @param {string} uid - The UID of the email to reject.
   */
  async rejectEmail(uid: string) {
    await this.client.messageMove({ uid }, `${this.ROOT_PATH}/REJECTED`, {
      uid: true,
    });
  }

  /**
   * Moves an email to the 'OUT' mailbox.
   * @param {string} uid - The UID of the email to accept.
   */
  async acceptEmail(uid: string) {
    await this.client.messageMove({ uid }, `${this.ROOT_PATH}/OUT`, {
      uid: true,
    });
  }
}
