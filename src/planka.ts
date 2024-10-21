import { client, createCard, getBoard, updateCard } from "planka-client";
import type { Board, Card, List } from "@gewis/planka-client";
import type { Client } from "@hey-api/client-fetch";
import type { CardEmail } from "./mailer.ts";

const DEFAULT_PLANKA_URL = Deno.env.get("PLANKA_URL") ||
  "http://localhost:3000";

interface CacheEntry {
  board: Board;
  preferredList: List; // Preference is: header if present, list called 'mail' if present, otherwise first list
}

export default class Planka {
  private static instance: Planka | null = null;
  private static client: Client | null = null;
  private settings: { plankaUrl?: string; plankaApiKey?: string };

  private static boardCache: Map<bigint, CacheEntry | null> = new Map();

  private constructor(settings: { plankaUrl?: string; plankaApiKey?: string }) {
    this.settings = settings;
    this.initializeClient();
  }

  /**
   * Initializes the Planka client with the provided settings.
   * Sets up API configuration like base URL and authentication.
   */
  private initializeClient() {
    if (!Planka.client) {
      const plankaUrl = this.settings.plankaUrl || DEFAULT_PLANKA_URL;
      const plankaApiKey = this.settings.plankaApiKey ||
        Deno.env.get("PLANKA_API_KEY");

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
  public static initialize(
    settings?: { plankaUrl?: string; plankaApiKey?: string },
  ): Planka {
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
      throw new Error(
        "Client has not been initialized. Please call initialize() first.",
      );
    }
  }

  /**
   * Pre-processes the cards to ensure the boards related to the cards are cached.
   * @param {CardEmail[]} cards - List of CardEmail objects to process.
   */
  static async preProcessCards(cards: CardEmail[]) {
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

      const board = await getBoard({ path: { id } });
      const status = board.response.status;

      if (status === 200) {
        // Find the preferred list, which is the list named 'mail' or the first list available
        const preferredList = board.data.included.lists.find((list: List) =>
          list.name.toLowerCase() === "mail"
        ) || board.data.included.lists[0];
        Planka.boardCache.set(id, { board: board.data, preferredList });
      } else if (status >= 400) {
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
  static async processCards(
    cards: CardEmail[],
  ): Promise<
    { result: { card: CardEmail; state: "ACCEPTED" | "REJECTED" }[] }
  > {
    Planka.pre();

    // Ensure boards are cached before card processing
    await Planka.preProcessCards(cards);

    const results: { card: CardEmail; state: "ACCEPTED" | "REJECTED" }[] = [];

    for (const card of cards) {
      const board = Planka.boardCache.get(card.boardId);

      if (!board) {
        // Reject card if the board is not found in the cache
        results.push({ card, state: "REJECTED" });
        continue;
      }

      const listId = card.listId || board.preferredList.id;

      // Create a new card in the appropriate list
      await createCard({
        path: {
          listId,
        },
        body: {
          name: card.title,
          position: 0,
        },
      }).then(async (cardResponse: Card) => {
        const status = cardResponse.response.status;
        if (status !== 200) return;

        results.push({ card, state: "ACCEPTED" });

        // Update the card's description and due date if provided
        if (card.body) {
          await updateCard({
            path: {
              id: cardResponse.data.item.id,
            },
            body: {
              description: card.body,
              dueDate: card.date ? card.date.toISOString() : null,
            },
          });
        }
      });
    }

    return results;
  }
}
