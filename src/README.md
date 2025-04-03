# SyntaxSentinels User Guide

This guide covers the setup and management of the SyntaxSentinels system, including the Compute Server, Frontend, and Express Server. It includes installation instructions, environment configuration, common tasks, and debugging tips.

---

## Table of Contents

1. [Overview](#overview)
2. [System Components](#system-components)
   - [Compute Server](#compute-server)
   - [Frontend](#frontend)
   - [Express Server](#express-server)
3. [Prerequisites](#prerequisites)
4. [Setup Instructions](#setup-instructions)
   - [Virtual Environment and Dependencies](#virtual-environment-and-dependencies)
   - [Environment Variables](#environment-variables)
5. [Running the Servers](#running-the-servers)
6. [Debugging and Troubleshooting](#debugging-and-troubleshooting)
7. [Additional Tips](#additional-tips)

---

## Overview

The SyntaxSentinels system is divided into three major components:

- **Compute Server**: Processes background jobs using Python and interacts with AWS (S3, SQS).
- **Frontend**: A client-facing application set up with Node.js.
- **Express Server**: Handles API requests and integrates with AWS and Firebase.

Each component has its own setup process and environment variables. This guide provides a step-by-step walkthrough for installation, configuration, and debugging common issues.

---

## System Components

### Compute Server

- **Language**: Python 3.11+
- **Key tasks**:
  - Virtual environment creation
  - Dependency installation using `requirements.txt`
  - Running the worker process to handle background jobs from an SQS queue

### Frontend

- **Language**: JavaScript (Node.js)
- **Key tasks**:
  - Installing Node.js packages via `npm install`
  - Configuring environment variables for Auth0 authentication and API integration

### Express Server

- **Language**: JavaScript (Node.js)
- **Key tasks**:
  - Installing Node.js packages via `npm install`
  - Configuring environment variables for authentication (Auth0), AWS services, and Firebase
  - Running the Express server for API endpoints

---

## Prerequisites

- **Python 3.11+** (verify with `python --version`)
- **Node.js and npm** (verify with `node --version` and `npm --version`)
- A compatible shell:
  - Windows: Command Prompt or PowerShell
  - Linux/macOS: Standard terminal

---

## Setup Instructions

### Virtual Environment and Dependencies

#### Compute Server

1. **Navigate** to the compute server directory (typically `backend`):

   ```bash
   cd backend
   ```

2. **Create** a virtual environment named `.venv`:

   ```bash
   python -m venv .venv
   ```

3. **Activate** the virtual environment:

   - **Windows Command Prompt**:

     ```bash
     .venv\Scripts\activate.bat
     ```

   - **Windows PowerShell**:

     ```powershell
     .venv\Scripts\Activate.ps1
     ```

   - **Linux/macOS**:

     ```bash
     source .venv/bin/activate
     ```

4. **Install dependencies**:

   ```bash
   pip install -r requirements.txt
   ```

#### Frontend

1. **Navigate** to the frontend directory:

   ```bash
   cd frontend
   ```

2. **Install Node packages**:

   ```bash
   npm install
   ```

#### Express Server

1. **Navigate** to the server directory:

   ```bash
   cd server
   ```

2. **Install Node packages**:

   ```bash
   npm install
   ```

### Environment Variables

Each component requires a set of environment variables. Create a `.env` file in each project folder as described below.

#### Compute Server (.env example)

Create a `.env` file or otherwise set these variables in your environment. Below is a table describing each:

| **Variable**            | **Description**                                     | **Example/Default**                                         |
| ----------------------- | --------------------------------------------------- | ----------------------------------------------------------- |
| `AWS_REGION`            | The AWS region where your resources are located.    | `us-east-1`                                                 |
| `AWS_ACCESS_KEY_ID`     | Your AWS access key ID for API authentication.      | _(none)_                                                    |
| `AWS_SECRET_ACCESS_KEY` | Your AWS secret access key for API authentication.  | _(none)_                                                    |
| `S3_BUCKET_NAME`        | The name of the S3 bucket where files are stored.   | `syntax-sentinels-uploads`                                  |
| `SQS_QUEUE_URL`         | The URL of the SQS queue for job processing.        | `https://sqs.us-east-1.amazonaws.com/123456789012/my-queue` |
| `EXPRESS_API_URL`       | The URL of the Express API for updating job status. | `http://localhost:3000/api`                                 |

```
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
S3_BUCKET_NAME=syntax-sentinels-uploads
SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123456789012/syntax-sentinels-queue
EXPRESS_API_URL=http://localhost:3000/api
```

#### Frontend (.env example)

Create a `.env` file or otherwise set these variables in your environment. Below is a table describing each:

| **Variable**           | **Description**                 | **Example/Default**                          |
| ---------------------- | ------------------------------- | -------------------------------------------- |
| `VITE_AUTH0_DOMAIN`    | Your Auth0 domain.              | `myauth0domain.us.auth0.com`                 |
| `VITE_AUTH0_CLIENT_ID` | Your Auth0 client ID.           | `123EXAMPLE`                                 |
| `VITE_AUTH0_AUDIENCE`  | The Auth0 audience identifier.  | `https://myauth0domain.us.auth0.com/api/v2/` |
| `VITE_API_URL`         | The API URL for express server. | `http://localhost:3001/api`                  |

```
VITE_AUTH0_DOMAIN=myauth0domain.us.auth0.com
VITE_AUTH0_CLIENT_ID=123EXAMPLE
VITE_AUTH0_AUDIENCE=https://myauth0domain.us.auth0.com/api/v2/
VITE_API_URL=http://localhost:3001/api
```

#### Express Server (.env example)

| **Variable**                           | **Description**                   | **Example/Default**                                                                                                 |
| -------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `AUTH0_DOMAIN`                         | Auth0 domain for authentication   | `dev-example123.us.auth0.com`                                                                                       |
| `AUTH0_CLIENT_ID`                      | Auth0 client ID                   | `abc123XYZ789example`                                                                                               |
| `AUTH0_AUDIENCE`                       | Auth0 API audience                | `https://dev-example123.us.auth0.com/api/v2/`                                                                       |
| `PORT`                                 | Port for the express server       | `3001`                                                                                                              |
| `AWS_ACCESS_KEY_ID`                    | AWS access key for S3/SQS         | `AKIAXXXXXXXXEXAMPLE`                                                                                               |
| `AWS_SECRET_ACCESS_KEY`                | AWS secret access key             | `wUrQJXXXXXXEXAMPLE`                                                                                                |
| `AWS_REGION`                           | AWS region for services           | `us-west-2`                                                                                                         |
| `S3_BUCKET_NAME`                       | S3 bucket name for file storage   | `example-bucket-uploads`                                                                                            |
| `SQS_QUEUE_URL`                        | SQS queue URL for background jobs | `https://sqs.us-west-2.amazonaws.com/123456789012/example-queue.fifo`                                               |
| `FIREBASE_TYPE`                        | Firebase authentication type      | `service_account`                                                                                                   |
| `FIREBASE_PROJECT_ID`                  | Firebase project ID               | `example-project-12345`                                                                                             |
| `FIREBASE_PRIVATE_KEY_ID`              | Firebase private key ID           | `1234567890abcdef1234567890abcdef`                                                                                  |
| `FIREBASE_PRIVATE_KEY`                 | Firebase private key              | `"-----BEGIN PRIVATE KEY-----\nMIIEv...EXAMPLE...\n-----END PRIVATE KEY-----\n"`                                    |
| `FIREBASE_CLIENT_EMAIL`                | Firebase service account email    | `firebase-adminsdk@example-project-12345.iam.gserviceaccount.com`                                                   |
| `FIREBASE_CLIENT_ID`                   | Firebase client ID                | `123456789012345678901`                                                                                             |
| `FIREBASE_AUTH_URI`                    | Firebase authentication URI       | `https://accounts.google.com/o/oauth2/auth`                                                                         |
| `FIREBASE_TOKEN_URI`                   | Firebase token endpoint           | `https://oauth2.googleapis.com/token`                                                                               |
| `FIREBASE_AUTH_PROVIDER_X509_CERT_URL` | Firebase provider cert URL        | `https://www.googleapis.com/oauth2/v1/certs`                                                                        |
| `FIREBASE_CLIENT_X509_CERT_URL`        | Firebase client cert URL          | `https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk@example-project-12345.iam.gserviceaccount.com` |
| `FIREBASE_UNIVERSE_DOMAIN`             | Firebase API domain               | `googleapis.com`                                                                                                    |

```
AUTH0_DOMAIN=dev-example123.us.auth0.com
AUTH0_CLIENT_ID=abc123XYZ789example
AUTH0_AUDIENCE=https://dev-example123.us.auth0.com/api/v2/
PORT=3001
AWS_ACCESS_KEY_ID=AKIAXXXXXXXXEXAMPLE
AWS_SECRET_ACCESS_KEY=wUrQJXXXXXXEXAMPLE+8sa4dTIQG+xuyx2khB
AWS_REGION=us-west-2
S3_BUCKET_NAME=example-bucket-uploads
SQS_QUEUE_URL=https://sqs.us-west-2.amazonaws.com/123456789012/example-queue.fifo
FIREBASE_TYPE=service_account
FIREBASE_PROJECT_ID=example-project-12345
FIREBASE_PRIVATE_KEY_ID=1234567890abcdef1234567890abcdef
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEv...EXAMPLE...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@example-project-12345.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=123456789012345678901
FIREBASE_AUTH_URI=https://accounts.google.com/o/oauth2/auth
FIREBASE_TOKEN_URI=https://oauth2.googleapis.com/token
FIREBASE_AUTH_PROVIDER_X509_CERT_URL=https://www.googleapis.com/oauth2/v1/certs
FIREBASE_CLIENT_X509_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk@example-project-12345.iam.gserviceaccount.com
FIREBASE_UNIVERSE_DOMAIN=googleapis.com
```

---

## Running the Servers

### Compute Server

1. **Activate** the virtual environment.
2. **Ensure** all environment variables are set.
3. **Start the worker process**:

   ```bash
   python worker.py
   ```

   _Note_: The worker process runs continuously in the background to process jobs from the SQS queue.

### Frontend

1. **Navigate** to the frontend directory.
2. **Ensure** the environment is set and dependencies are installed.
3. **Start the frontend server**:

   ```bash
   npm run dev
   ```

### Express Server

1. **Navigate** to the server directory.
2. **Ensure** all environment variables are correctly set.
3. **Start the Express server**:

   ```bash
   npm start
   ```

---

## Debugging and Troubleshooting

When issues arise, follow these steps to diagnose and resolve common problems:

### 1. Virtual Environment Issues (Compute Server)

- **Not Activated**: If you encounter errors related to missing packages, verify that your virtual environment is active. The command prompt should show `(.venv)` at the beginning.
- **Reinstall Dependencies**: Sometimes, reinstalling dependencies can help:
  ```bash
  pip install --force-reinstall -r requirements.txt
  ```
- **Python Version**: Ensure you are using Python 3.11+ by checking with `python --version`.

### 2. Dependency Errors (Frontend/Express Server)

- **Node Modules Missing**: If you get errors about missing modules, ensure you have run:
  ```bash
  npm install
  ```
- **Version Conflicts**: Verify that your Node.js and npm versions meet the project's requirements. Sometimes clearing the cache or deleting `node_modules` and reinstalling can help:
  ```bash
  rm -rf node_modules
  npm cache clean --force
  npm install
  ```

### 3. Environment Variable Misconfigurations

- **Missing Variables**: Double-check your `.env` files in each project directory. Missing or misconfigured variables can lead to runtime errors.
- **Sensitive Keys**: Ensure that keys (e.g., AWS keys, Firebase private keys) are correctly formatted and enclosed in quotes if necessary.
- **Testing Variables**: Add logging at the start of your application to print the values (excluding sensitive data) to ensure they are loaded correctly.

### 4. Server Start-Up Failures

- **Port Conflicts**: If a server fails to start due to a port conflict, confirm that the specified port (e.g., 3000 for Express or 3001) is not already in use.
- **Detailed Logs**: Increase logging verbosity in your server code to capture more detailed error messages. This can often be enabled via environment variables (e.g., `DEBUG=true`) or command-line flags.

### 5. Debugging AWS and Firebase Integrations

- **AWS Errors**: If you see errors related to AWS services (S3/SQS), ensure that your AWS credentials and region are correctly set. Use AWS CLI commands to verify credentials:
  ```bash
  aws sts get-caller-identity
  ```
- **Firebase Errors**: Check that your Firebase credentials are correctly formatted and that your Firebase project configuration matches the values in your `.env`.

### 6. General Debugging Tools

- **Logs**: Always review the console logs for error messages. Many frameworks provide stack traces that point to the source of the issue.
- **Breakpoints**: Use debugging tools (e.g., Python’s `pdb` or Node.js debugging with VS Code) to set breakpoints and step through your code.
- **Community Resources**: Look up error messages online or consult the official documentation for Python, Node.js, AWS, or Firebase.

---

## Additional Tips

- **Documentation**: Keep this guide updated as your project evolves. Document any unique configurations or changes in dependencies.
- **Version Control**: Use Git (or another version control system) to track changes to your configuration and setup files.
- **Backups**: Always backup your `.env` files securely, as they contain sensitive information.
- **Testing**: Regularly test each component independently before integrating them to isolate issues faster.
- **Environment Parity**: Ensure your development environment mirrors production as closely as possible to avoid deployment issues.

---
