# Instagram Media Downloader

A simple web application to download high-quality images and videos from public Instagram posts.

## Features

-   **Simple Interface**: Just paste the Instagram post URL and click download.
-   **High Quality**: Downloads the highest resolution available for media.
-   **Single Images**: Download images from single-image posts.
-   **Videos**: Download videos from single-video posts.
-   **Carousels**: Download all images and videos from a carousel (multi-media) post.
-   **Modern UI**: Clean, responsive, and easy-to-use interface.

## Technology Stack

-   **Backend**: Node.js, Express.js
-   **Frontend**: HTML, CSS, JavaScript (no frameworks)
-   **Fetching**: `node-fetch` for server-side requests.

## Installation

1.  **Clone the repository** (if you haven't already):
    ```bash
    git clone <repository-url>
    cd <repository-directory>
    ```

2.  **Install dependencies**:
    This project uses Node.js and npm. Make sure you have them installed.
    ```bash
    npm install
    ```

## Usage

1.  **Start the server**:
    ```bash
    npm start
    ```
    The server will start on `http://localhost:3000`.

2.  **Open the application**:
    Open your web browser and navigate to `http://localhost:3000`.

3.  **Download Media**:
    -   Copie o URL de um post público do Instagram.
    -   Cole o URL na caixa de texto da página.
    -   Clique no botão "Baixar".
    -   As mídias do post aparecerão em uma galeria. Passe o mouse sobre qualquer item para ver o link de download.

## How It Works

This tool works by fetching the HTML of the public Instagram post URL. It then looks for a JSON object embedded within the HTML source code that contains data about the post, including direct URLs to the media. If this data is not found, it falls back to scraping standard `og:image` and `og:video` meta tags. This process is done on the server-side to avoid CORS issues that would occur in a browser.
