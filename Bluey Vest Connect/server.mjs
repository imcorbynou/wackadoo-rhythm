// Share the homepage server so homepage, connection page and game use one origin.
process.env.BLUEY_START_PATH = '/vest-connect/';
await import('../bluey homepage/server.mjs');
