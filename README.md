# 📧 Planka Email Integration

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

> [!NOTE]  
> The projects uses packages hosted on GitHub Packages, and requires a GitHub token to be set up in the environment.
> You can follow the instructions [here](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry#authenticating-to-github-packages) to set up a token.

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

To email the application, make sure to first read the Email Setup section below. If you have set up the email account correctly, it should work out of the box.

For the application to accept an email, it must have a `X-Planka-Board-ID` and optionally a `X-Planka-List-ID` header.
The `X-Planka-Board-ID` header should contain the ID of the board to create the card on, while the `X-Planka-List-ID` header (if present) should contain the ID of the list to create the card in.
If the `X-Planka-List-ID` header is not present, the application will create the card in a list with the name `Mail`. If this also does not exist, it will add it to the first list in the board.

Adding custom headers to an email is not something that most email clients support. Thunderbird has an add-on called [Header Tools Lite](https://addons.thunderbird.net/en-US/thunderbird/addon/header-tools-lite/) which we recommend.

> [!NOTE]  
> The Planka account used by the application must have write access to the planka board to create cards.

## Email Setup

To use this application, you will need to set up an email account with a provider that supports IMAP (such as Gmail, Outlook, or Yahoo).
By default, the application look for emails in the `API` mailbox. You can change this by modifying the `IMAP_ROOT` environment variable.

Make sure that the following folders exist in the `IMAP_ROOT` mailbox:

- `IN`
- `OUT`
- `REJECTED`

These folders will be used to store the incoming, processed, and rejected emails, respectively.
The application will not create these folders if they do not exist, so make sure to create them before running the application.

> [!IMPORTANT]  
> E-mails send to the inbox will not be processed. This is by design, as a planka board id is not secret and would allow anyone to create a card on the board.
> Therefore, you should add a filter to your email account which will file emails to the `IN` folder if they are from a trusted sender.

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
| `LOG_LEVEL`      | The log level for the application.                      | `info`                  |

### `PLANKA_API_KEY`:
Currently, Planka does not official support API keys. This means that you will have to insert a long-lived session token in the database manually.

## Code Overview

This application follows a structured workflow to integrate email processing with Planka. The main process involves initializing a Planka client, retrieving emails from an IMAP server, and processing them to create cards in Planka. Emails are categorized and handled based on the results of the processing:

1. **Email Retrieval**: The `Mailer` class connects to the IMAP server to fetch emails, extract information, and identify board and list IDs from email headers.
2. **Card Creation**: The `Planka` class uses the extracted data to create cards on the specified Planka board and list.
3. **Result Handling**: The `Mailer` class moves processed emails into designated mailboxes (`OUT` for accepted and `REJECTED` for rejected emails).

This workflow runs on a scheduled basis using a Dockerized setup, executing the primary script (`index.ts`) at regular intervals.

## License

This project is licensed under the GNU General Public License. See the [LICENSE](LICENSE) file for details.