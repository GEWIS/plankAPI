# Planka Email Integration

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

2. **Set Up Yarn**

   Make sure you have [Yarn](https://yarnpkg.com/getting-started/install) installed. You can follow the installation guide on the Yarn website.

3. **Install Dependencies**

   Run the following command to install the required dependencies:

   ```bash
   yarn install
   ```

4. **Copy the .env-example File**

   ```bash
   cp .env-example .env
   ```

   Make sure to replace the default values with actual credentials before running the application.

## Usage

To run the application, ensure you have the required environment variables set up (see below). Then, execute the script:

```bash
yarn start:env
```

The application is also available as a Docker image. To build the image, run the following command:

```bash
docker build -t plankapi .
```

The image will execute `yarn start` using a cron schedule, which will run the application every hour.

## Email Setup

To use this application, you will need to set up an email account with a provider that supports IMAP (such as Gmail, Outlook, or Yahoo).
By default, the application look for emails in the `API` mailbox. You can change this by modifying the `IMAP_ROOT` environment variable.

Make sure that the following folders exist in the `IMAP_ROOT` mailbox:

- `IN`
- `OUT`
- `REJECTED`

These folders will be used to store the incoming, processed, and rejected emails, respectively.
The application will not create these folders if they do not exist, so make sure to create them before running the application.

## Environment Variables

This application requires several environment variables to function correctly. Below is a table that describes each variable, its purpose, and its default value.

| Variable         | Description                                             | Default Value           |
|------------------|---------------------------------------------------------|-------------------------|
| `IMAP_HOST`      | The hostname of the IMAP server for email retrieval.    | `localhost`             |
| `IMAP_PORT`      | The port number for the IMAP server.                    | `993`                   |
| `IMAP_TLS`       | Indicates whether to use TLS for the IMAP connection.   | `undefined`             |
| `IMAP_ROOT`      | Root mailbox folder to use for email retrieval.         | `API`                   |
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
import Mailer from "./mailer";
import Planka from "./planka";

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
if (require.main === module) {
   void main();
}
```

The `Dockerfile` will simply execute the index.ts file based on a cron schedule.

### Mailer Class

The `Mailer` class is responsible for connecting to the IMAP server, handling emails, and moving accepted or rejected emails to appropriate mailboxes.

### Planka Class

The `Planka` class initializes the Planka client, caches boards, and processes card creation based on emails received.

## License

This project is licensed under the GNU General Public License. See the [LICENSE](LICENSE) file for details.