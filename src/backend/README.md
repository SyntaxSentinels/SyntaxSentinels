# SyntaxSentinels Source Code

This folder contains the **source code** for the SyntaxSentinels backend, built with Python and SQS.

## Table of Contents

1. [Project Overview](#project-overview)
2. [Prerequisites](#prerequisites)
3. [Setting Up the Virtual Environment](#setting-up-the-virtual-environment)
   - [Windows](#windows)
   - [Linux-and-macOS](#linux-and-macos)
4. [Installing Dependencies](#installing-dependencies)
5. [Environment Variables](#environment-variables)
6. [Running the Server](#running-the-server)

---

## Project Overview

- Auth0 is used for authentication (`AUTH0_DOMAIN`, `AUTH0_AUDIENCE`, etc. in your environment variables).
- Common tasks include:
  - Activating a virtual environment.
  - Installing Python packages from `requirements.txt`.
  - Starting the SQS polling worker.

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

---

**That's it!** Your SQS worker for SyntaxSentinels should now be up and running. Adjust the commands or details above as needed for your specific setup.
