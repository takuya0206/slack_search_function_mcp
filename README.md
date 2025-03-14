# Slack Search MCP Server

A Model Context Protocol (MCP) server that provides tools and resources to access Slack's search functionality. This server allows LLMs to search and retrieve users, channels, messages, and more from a Slack workspace.

## Features

### Tools

1. `get_users` - Get a list of users in the Slack workspace
2. `get_channels` - Get a list of channels in the Slack workspace
3. `get_channel_messages` - Get messages from a specific channel
4. `get_thread_replies` - Get replies in a thread
5. `search_messages` - Search for messages in Slack

### Resources

1. `allusers://` - Get all users in the Slack workspace
2. `allchannels://` - Get all channels in the Slack workspace

## Requirements

- [Bun](https://bun.sh/) runtime
- Slack API token with appropriate permissions

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   bun install
   ```

## Usage

1. Set the Slack API token as an environment variable:
   ```bash
   export SLACK_TOKEN=xoxb-your-token-here
   ```

2. Run the server:
   ```bash
   bun run index.ts
   ```

   Or use the compiled version:
   ```bash
   ./dist/slack_search_function_mcp
   ```

## Building

To build the executable:

```bash
bun run build
```

This will create a compiled executable in the `dist` directory.

## MCP Configuration

To use this server with an MCP-enabled LLM, add it to your MCP configuration:

```json
{
  "mcpServers": {
    "slack": {
      "command": "/path/to/dist/slack_search_function_mcp",
      "env": {
        "SLACK_TOKEN": "xoxb-your-token-here"
      }
    }
  }
}
```

## Tool Examples

### Get Users

```json
{
  "name": "get_users",
  "arguments": {
    "limit": 10
  }
}
```

### Get Channels

```json
{
  "name": "get_channels",
  "arguments": {
    "limit": 10,
    "exclude_archived": true
  }
}
```

### Get Channel Messages

```json
{
  "name": "get_channel_messages",
  "arguments": {
    "channel": "C01234ABCDE",
    "limit": 10
  }
}
```

### Get Thread Replies

```json
{
  "name": "get_thread_replies",
  "arguments": {
    "channel": "C01234ABCDE",
    "thread_ts": "1234567890.123456",
    "limit": 10
  }
}
```

### Search Messages

```json
{
  "name": "search_messages",
  "arguments": {
    "query": "important announcement",
    "sort": "timestamp",
    "sort_dir": "desc",
    "count": 10
  }
}
```

## Resource Examples

### Get All Users

```
allusers://
```

### Get All Channels

```
allchannels://
```

## Error Handling

The server includes comprehensive error handling for:
- Invalid or missing Slack API token
- API rate limits
- Network errors
- Invalid parameters
- Authentication failures

## Security

- The Slack API token is never logged or exposed in responses
- The token is securely passed via environment variables
