# SyntaxSentinels Source Code

This folder contains the **source code** for the SyntaxSentinels backend, built with Python and Flask.

## Table of Contents

1. [Project Overview](#project-overview)
2. [Prerequisites](#prerequisites)
3. [Setting Up the Virtual Environment](#setting-up-the-virtual-environment)
   - [Windows](#windows)
   - [Linux-and-macOS](#linux-and-macos)
4. [Installing Dependencies](#installing-dependencies)
5. [Environment Variables](#environment-variables)
6. [Running the Server](#running-the-server)
7. [Docker Setup](#docker-setup)
   - [Prerequisites for Docker](#prerequisites-for-docker)
   - [Building and Running with Docker](#building-and-running-with-docker)
   - [Docker Compose](#docker-compose)

---

## Project Overview

- The backend runs on **Flask**.
- Auth0 is used for authentication (`AUTH0_DOMAIN`, `AUTH0_AUDIENCE`, etc. in your environment variables).
- Common tasks include:
  - Activating a virtual environment.
  - Installing Python packages from `requirements.txt`.
  - Starting the Flask development server.

---

## Prerequisites

- **Python 3.7+** (check via `python --version`).
- A compatible shell (Command Prompt, PowerShell on Windows, or a standard terminal on Linux/macOS).

---

## Setting Up the Virtual Environment

1. **Navigate** to the backend directory:

   ```bash
   cd backend
   ```

2. **Create** the virtual environment (named `.venv`):
   ```bash
   python -m venv .venv
   ```

### Windows

- **Command Prompt**:
  ```bash
  .venv\Scripts\activate.bat
  ```
- **PowerShell**:
  ```powershell
  .venv\Scripts\Activate.ps1
  ```

### Linux and macOS

```bash
source .venv/bin/activate
```

Once activated, your terminal prompt should prefix with `(.venv)` or similar.

---

## Installing Dependencies

Make sure you are **inside** the activated `.venv` environment, then run:

```bash
pip install -r requirements.txt
```

_(Note: the previous command was `pip install -m requirements.txt`; typically it should be `-r` for installing from a file.)_

---

## Environment Variables

Create a `.env` file or otherwise set these variables in your environment. Below is a table describing each:

| **Variable**            | **Description**                                                           | **Example/Default**                                         |
| ----------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `FLASK_ENV`             | Sets the Flask environment mode. Typically `development` or `production`. | `development`                                               |
| `PORT`                  | The port on which the Flask app listens.                                  | `5000`                                                      |
| `AUTH0_DOMAIN`          | Your Auth0 tenant domain, e.g. `your-tenant.us.auth0.com`.                | _(none)_                                                    |
| `AUTH0_AUDIENCE`        | The Auth0 audience for your API.                                          | _(none)_                                                    |
| `AUTH0_CLIENT_ID`       | The Auth0 Client ID used by the app.                                      | _(none)_                                                    |
| `APP_NAME`              | The name of your application.                                             | `SyntaxSentinels`                                           |
| `AWS_REGION`            | The AWS region where your resources are located.                          | `us-east-1`                                                 |
| `AWS_ACCESS_KEY_ID`     | Your AWS access key ID for API authentication.                            | _(none)_                                                    |
| `AWS_SECRET_ACCESS_KEY` | Your AWS secret access key for API authentication.                        | _(none)_                                                    |
| `S3_BUCKET_NAME`        | The name of the S3 bucket where files are stored.                         | `syntax-sentinels-uploads`                                  |
| `SQS_QUEUE_URL`         | The URL of the SQS queue for job processing.                              | `https://sqs.us-east-1.amazonaws.com/123456789012/my-queue` |
| `EXPRESS_API_URL`       | The URL of the Express API for updating job status.                       | `http://localhost:3000/api`                                 |

Example `.env`:

```
FLASK_ENV=development
PORT=5000
AUTH0_DOMAIN=your-tenant.us.auth0.com
AUTH0_AUDIENCE=my-api
AUTH0_CLIENT_ID=abc123
APP_NAME=SyntaxSentinels
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
S3_BUCKET_NAME=syntax-sentinels-uploads
SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123456789012/syntax-sentinels-queue
EXPRESS_API_URL=http://localhost:3000/api
```

---

## Running the Server

### Running the Worker Process

The worker process handles background jobs by polling an SQS queue, processing files, and updating job status.

1. Ensure the virtual environment is **activated**.
2. Make sure all required environment variables are set (especially AWS-related ones).
3. **Start** the worker:
   ```bash
   python worker.py
   ```

**Note**: The worker process doesn't expose any HTTP endpoints. It runs continuously in the background, processing jobs from the SQS queue.

---

## Docker Setup

This project includes Docker configuration for easy deployment and development. Docker allows you to run the application in isolated containers without worrying about dependencies or environment setup.

### Prerequisites for Docker

- [Docker](https://docs.docker.com/get-docker/) installed on your system
- [Docker Compose](https://docs.docker.com/compose/install/) (included with Docker Desktop for Windows and Mac)

### Building and Running with Docker

1. **Build the Docker image**:

   ```bash
   cd src/backend
   docker build -t syntax-sentinels-backend .
   ```

2. **Run the container**:

   ```bash
   # To run the worker process (default behavior after Dockerfile update)
   docker run --env-file .env syntax-sentinels-backend

   # To run the Flask web server instead
   docker run -p 5000:5000 --env-file .env syntax-sentinels-backend python worker.py
   ```

   Note that the worker process doesn't need port mapping since it doesn't expose any HTTP endpoints.

### Docker Compose

For a more complete setup that includes both the web server and worker process:

1. **Create a `.env` file** based on the provided `.env.example`:

   ```bash
   cp .env.example .env
   # Edit .env with your actual values
   ```

2. **Start the services**:

   ```bash
   docker-compose up
   ```

   This will start both the web server and the worker process.

3. **Run in background** (optional):

   ```bash
   docker-compose up -d
   ```

4. **View logs**:

   ```bash
   docker-compose logs -f
   ```

5. **Stop the services**:

   ```bash
   docker-compose down
   ```

The Docker setup includes:

- A web service running the Flask application
- A worker service for background processing
- Environment variable configuration
- Volume mapping for code changes

**Note**: When using Docker, you don't need to set up a virtual environment or install dependencies locally, as everything is contained within the Docker containers.

---

**That's it!** Your Flask backend for SyntaxSentinels should now be up and running. Adjust the commands or details above as needed for your specific setup.
