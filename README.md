
# Planka email integration

This project integrates email processing with [Planka](https://github.com/plankanban/planka?tab=readme-ov-file), a Kanban board management tool. The application retrieves emails, extracts relevant information to create cards on Planka, and manages the acceptance or rejection of these cards based on specific criteria.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [Environment Variables](#environment-variables)
- [Code Overview](#code-overview)
- [License](#license)

## Features

- Fetches emails from an IMAP server.
- Extracts board and list IDs from email headers.
- Creates cards in Planka based on the extracted email information.
- Handles the results by moving accepted/rejected emails to appropriate mailboxes.

## Installation

1. **Clone the Repository**

   ```bash
   git clone https://github.com/GEWIS/plankAPI.git
   cd plankAPI
   ```

2. **Set Up Deno**

   Make sure you have Deno installed. You can follow the installation guide on the [Deno website](https://deno.land/#installation).

3. **Install Dependencies**

   Deno handles dependencies through imports, so you don’t need a separate installation step.

4. **Copy the .env-example File**

    ```bash
    cp .env-example .env
    ```

   Make sure to replace the default values with actual credentials before running the application.

## Usage

To run the application, ensure you have the required environment variables set up (see below). Then, execute the script:

```bash
deno task exec:env
```

## Environment Variables

This application requires several environment variables to function correctly. Below is a table that describes each variable, its purpose, and its default value.

| Variable         | Description                                             | Default Value           |
|------------------|---------------------------------------------------------|-------------------------|
| `IMAP_HOST`      | The hostname of the IMAP server for email retrieval.    | `localhost`             |
| `IMAP_PORT`      | The port number for the IMAP server.                    | `993`                   |
| `IMAP_TLS`       | Indicates whether to use TLS for the IMAP connection.   | `undefined`             |
| `IMAP_USERNAME`  | The username for authenticating with the IMAP server.   | `user`                  |
| `IMAP_PASSWORD`  | The password for the IMAP account.                      | `undefined`             |
| `PLANKA_API_KEY` | The API key for authenticating with the Planka service. | `undefined`             |
| `PLANKA_URL`     | The base URL of the Planka API.                         | `http://localhost:3000` |

### Note:
Make sure to replace the default values with actual credentials before running the application.

## Code Overview

### Main Workflow

The main workflow is defined in `index.ts`:

```typescript
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
```

### Mailer Class

The `Mailer` class is responsible for connecting to the IMAP server, handling emails, and moving accepted or rejected emails to appropriate mailboxes.

### Planka Class

The `Planka` class initializes the Planka client, caches boards, and processes card creation based on emails received.

## License

This project is licensed under the GNU General Public License. See the [LICENSE](LICENSE) file for details.
