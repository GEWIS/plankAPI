import {
  client,
  createCard,
  CreateCardRequest,
  UpdateCardRequest,
  getBoard,
  updateCard,
  GetBoardRequest,
  GetBoardResponse,
} from '@gewis/planka-client';
import type { List } from '@gewis/planka-client';
import type { Client, Options } from '@hey-api/client-fetch';
import { getLogger } from 'log4js';
import type { CardEmail } from './mailer.ts';

const DEFAULT_PLANKA_URL = process.env['PLANKA_URL'] || 'http://localhost:3000';

interface CacheEntry {
  board: GetBoardResponse;
  preferredList: List | null; // Preference is: header if present, list called 'mail' if present, otherwise first list
}

export default class Planka {
  private static instance: Planka | null = null;
  private static client: Client | null = null;
  private settings: { plankaUrl?: string; plankaApiKey?: string };

  private static boardCache: Map<bigint, CacheEntry | null> = new Map();

  private static readonly logger = getLogger('Planka');

  private constructor(settings: { plankaUrl?: string; plankaApiKey?: string }) {
    this.settings = settings;
    Planka.logger.level = process.env['LOG_LEVEL'] || 'info';
    this.initializeClient();
  }

  /**
   * Initializes the Planka client with the provided settings.
   * Sets up API configuration like base URL and authentication.
   */
  private initializeClient() {
    if (!Planka.client) {
      const plankaUrl = this.settings.plankaUrl || DEFAULT_PLANKA_URL;
      const plankaApiKey = this.settings.plankaApiKey || process.env['PLANKA_API_KEY'];

      client.setConfig({
        baseUrl: plankaUrl,
        headers: {
          Authorization: `Bearer ${plankaApiKey}`,
        },
      });
      Planka.client = client;
    }
  }

  /**
   * Initializes the Planka singleton instance.
   * @param {Object} [settings] - Optional settings for Planka initialization.
   * @returns {Planka} Returns the singleton instance of Planka.
   */
  public static initialize(settings?: { plankaUrl?: string; plankaApiKey?: string }): Planka {
    if (!Planka.instance) {
      Planka.instance = new Planka(settings || {});
    }
    return Planka.instance;
  }

  /**
   * Ensures that the client is initialized before any Planka operations.
   * Throws an error if the client isn't initialized.
   */
  private static pre() {
    if (!Planka.client) {
      throw new Error('Client has not been initialized. Please call initialize() first.');
    }
  }

  /**
   * Pre-processes the cards to ensure the boards related to the cards are cached.
   * @param {CardEmail[]} cards - List of CardEmail objects to process.
   */
  static async preProcessCards(cards: CardEmail[]) {
    Planka.logger.trace('pre processing', cards.length, 'cards');
    Planka.pre();
    const boardIds = new Set<bigint>();
    for (const card of cards) {
      boardIds.add(card.boardId);
    }
    await Planka.cacheBoards([...boardIds]);
  }

  /**
   * Caches the boards and their preferred lists.
   * @param {bigint[]} ids - Array of board IDs to cache.
   */
  static async cacheBoards(ids: bigint[]) {
    Planka.pre();
    // Clear previous cache
    Planka.boardCache = new Map();

    for (const id of ids) {
      if (Planka.boardCache.has(id)) {
        continue;
      }

      const board = await getBoard({ path: { id: id.toString() } } as Options<GetBoardRequest, false>);
      const status = board.response.status;
      Planka.logger.trace('caching board', id, 'status', status);

      if (status === 200 && board.data) {
        // Find the preferred list, which is the list named 'mail' or the first list available
        let preferredList = null;
        const lists: List[] = (board.data?.included as { lists: List[] })?.lists ?? [];

        if (lists.length > 0) {
          // Find the list named 'mail', or fall back to the first list if not found
          preferredList = lists.find((list: List) => list.name.toLowerCase() === 'mail') || lists[0];
        }

        Planka.boardCache.set(id, { board: board.data, preferredList });
      } else if (status >= 400) {
        Planka.logger.warn('error caching board', id, 'status', status);
        // Mark board as null in case of error
        Planka.boardCache.set(id, null);
      }
    }
  }

  /**
   * Processes a list of CardEmail objects and creates Planka cards based on them.
   * @param {CardEmail[]} cards - List of CardEmail objects to process.
   * @returns {Promise<{result: {card: CardEmail, state: 'ACCEPTED' | 'REJECTED'}[]}>}
   * Returns a result object indicating whether each card was accepted or rejected.
   */
  static async processCards(cards: CardEmail[]): Promise<{ card: CardEmail; state: 'ACCEPTED' | 'REJECTED' }[]> {
    Planka.pre();

    // Ensure boards are cached before card processing
    await Planka.preProcessCards(cards);

    const results: { card: CardEmail; state: 'ACCEPTED' | 'REJECTED' }[] = [];

    for (const card of cards) {
      const board = Planka.boardCache.get(card.boardId);

      if (!board) {
        Planka.logger.warn('rejecting card', card.uid, 'board not found');
        // Reject card if the board is not found in the cache
        results.push({ card, state: 'REJECTED' });
        continue;
      }

      const listId = card.listId || board.preferredList?.id;
      if (!listId) {
        Planka.logger.warn('rejecting card', card.uid, 'list not found');
        // Reject card if the board has no list
        results.push({ card, state: 'REJECTED' });
        continue;
      }

      // Create a new card in the appropriate list
      await createCard({
        path: {
          listId,
        },
        body: {
          name: card.title,
          position: 0,
        },
      } as Options<CreateCardRequest, false>).then(async (result) => {
        Planka.logger.trace('created card', card.uid, 'status', result.response.status);
        const cardResult = result.data;
        const status = result.response.status;

        if (status !== 200 || !cardResult) return;

        results.push({ card, state: 'ACCEPTED' });

        // Update the card's description and due date if provided
        if (card.body) {
          await updateCard({
            path: {
              id: cardResult.item.id,
            },
            body: {
              description: card.body,
              dueDate: card.date ? card.date : null,
            },
          } as Options<UpdateCardRequest>)
            .then((result) => {
              Planka.logger.trace('updated card', card.uid, 'status', result.response.status);
            })
            .catch((e) => {
              Planka.logger.error('error updating card', card.uid, e);
            });
        }
      });
    }

    return results;
  }
}
