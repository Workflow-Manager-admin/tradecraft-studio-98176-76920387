# AI Assistant API Key Usage in Quantico Frontend

## Overview
The Quantico frontend uses an environment variable, `REACT_APP_AI_API_KEY`, to access the AI assistant's API for chat and suggestion features. This is stored securely in the `.env` file at the root of the `quantico_frontend` directory.

## How to Use

- The React app will automatically load environment variables prefixed with `REACT_APP_` at build time.
- Example usage in code:
    ```js
    const aiApiKey = process.env.REACT_APP_AI_API_KEY;
    ```
- This variable should NOT be hardcoded in code. Always reference via `process.env.REACT_APP_AI_API_KEY`.

## Security and Best Practices

- **Never** commit real API keys to public repositories.
- For deployment, store the API key in hosting service secrets (Vercel, Netlify, AWS, etc).
- When running locally, copy the `.env.example` to `.env` and supply the value for `REACT_APP_AI_API_KEY`.
- For production builds, the environment variable must be present at build time.

## Example .env
```
REACT_APP_AI_API_KEY=your_api_key_here
```

## Regenerating/Rotating Keys

If you need to rotate the API key:
1. Update the value in your secret manager and deployment environment.
2. Update `.env` for local development.
3. Trigger a build/redeployment.

## Reference

- [Create React App: Adding Custom Environment Variables](https://create-react-app.dev/docs/adding-custom-environment-variables/)
