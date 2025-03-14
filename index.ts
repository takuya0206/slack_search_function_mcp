#!/usr/bin/env bun
import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { WebClient, ErrorCode as SlackErrorCode } from "@slack/web-api";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";

// Get Slack API token from environment variables
const SLACK_TOKEN = process.env.SLACK_TOKEN;

if (!SLACK_TOKEN) {
  console.error("Error: SLACK_TOKEN environment variable is required");
  process.exit(1);
}

// Create Slack Web Client
const slack = new WebClient(SLACK_TOKEN);

// Create an MCP server
const server = new McpServer({
  name: "slack-search-mcp",
  version: "1.0.0",
});

// Validate Slack token on startup
async function validateSlackToken() {
  try {
    await slack.auth.test();
    console.error("Successfully connected to Slack API");
  } catch (error: any) {
    console.error("Failed to connect to Slack API:", error);
    process.exit(1);
  }
}

// Common schemas
const tokenSchema = z.string().describe("Slack API token");

// Common error handling function
function handleSlackError(error: any): never {
  console.error("Slack API error:", error);
  
  if (error.code === SlackErrorCode.PlatformError) {
    throw new McpError(
      ErrorCode.InternalError,
      `Slack API error: ${error.data?.error || "Unknown error"}`
    );
  } else if (error.code === SlackErrorCode.RequestError) {
    throw new McpError(
      ErrorCode.InternalError,
      "Network error when connecting to Slack API"
    );
  } else if (error.code === SlackErrorCode.RateLimitedError) {
    throw new McpError(
      ErrorCode.InternalError,
      "Rate limited by Slack API"
    );
  } else if (error.code === SlackErrorCode.HTTPError) {
    throw new McpError(
      ErrorCode.InternalError,
      `HTTP error: ${error.statusCode}`
    );
  } else {
    throw new McpError(
      ErrorCode.InternalError,
      `Unexpected error: ${error.message || "Unknown error"}`
    );
  }
}

// Tool: get_users
server.tool(
  "get_users",
  "Get a list of users in the Slack workspace",
  {
    token: tokenSchema.optional(),
    limit: z.number().min(1).max(1000).optional().describe("Maximum number of users to return"),
    cursor: z.string().optional().describe("Pagination cursor for fetching next page"),
  },
  async ({ token = SLACK_TOKEN, limit = 100, cursor }) => {
    try {
      const response = await slack.users.list({
        token,
        limit,
        cursor,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              users: response.members,
              next_cursor: response.response_metadata?.next_cursor,
              has_more: !!response.response_metadata?.next_cursor,
            }, null, 2),
          },
        ],
      };
    } catch (error: any) {
      handleSlackError(error);
    }
  }
);

// Tool: get_channels
server.tool(
  "get_channels",
  "Get a list of channels in the Slack workspace",
  {
    token: tokenSchema.optional(),
    limit: z.number().min(1).max(1000).optional().describe("Maximum number of channels to return"),
    cursor: z.string().optional().describe("Pagination cursor for fetching next page"),
    exclude_archived: z.boolean().optional().describe("Exclude archived channels"),
    types: z.string().optional().describe("Types of channels to include (public_channel, private_channel, mpim, im)"),
  },
  async ({ token = SLACK_TOKEN, limit = 100, cursor, exclude_archived = true, types = "public_channel,private_channel" }) => {
    try {
      const response = await slack.conversations.list({
        token,
        limit,
        cursor,
        exclude_archived,
        types,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              channels: response.channels,
              next_cursor: response.response_metadata?.next_cursor,
              has_more: !!response.response_metadata?.next_cursor,
            }, null, 2),
          },
        ],
      };
    } catch (error: any) {
      handleSlackError(error);
    }
  }
);

// Tool: get_channel_messages
server.tool(
  "get_channel_messages",
  "Get messages from a specific channel",
  {
    token: tokenSchema.optional(),
    channel: z.string().describe("Channel ID"),
    limit: z.number().min(1).max(1000).optional().describe("Maximum number of messages to return"),
    oldest: z.string().optional().describe("Start of time range (Unix timestamp)"),
    latest: z.string().optional().describe("End of time range (Unix timestamp)"),
    inclusive: z.boolean().optional().describe("Include messages with timestamps matching oldest or latest"),
    cursor: z.string().optional().describe("Pagination cursor for fetching next page"),
  },
  async ({ token = SLACK_TOKEN, channel, limit = 100, oldest, latest, inclusive, cursor }) => {
    try {
      // Validate channel ID format
      if (!channel.match(/^[A-Z0-9]+$/i)) {
        throw new McpError(
          ErrorCode.InvalidParams,
          "Invalid channel ID format"
        );
      }

      const response = await slack.conversations.history({
        token,
        channel,
        limit,
        oldest,
        latest,
        inclusive,
        cursor,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              messages: response.messages,
              has_more: response.has_more,
              next_cursor: response.response_metadata?.next_cursor,
            }, null, 2),
          },
        ],
      };
    } catch (error: any) {
      handleSlackError(error);
    }
  }
);

// Tool: get_thread_replies
server.tool(
  "get_thread_replies",
  "Get replies in a thread",
  {
    token: tokenSchema.optional(),
    channel: z.string().describe("Channel ID"),
    thread_ts: z.string().describe("Timestamp of the parent message"),
    limit: z.number().min(1).max(1000).optional().describe("Maximum number of replies to return"),
    oldest: z.string().optional().describe("Start of time range (Unix timestamp)"),
    latest: z.string().optional().describe("End of time range (Unix timestamp)"),
    inclusive: z.boolean().optional().describe("Include messages with timestamps matching oldest or latest"),
    cursor: z.string().optional().describe("Pagination cursor for fetching next page"),
  },
  async ({ token = SLACK_TOKEN, channel, thread_ts, limit = 100, oldest, latest, inclusive, cursor }) => {
    try {
      // Validate channel ID format
      if (!channel.match(/^[A-Z0-9]+$/i)) {
        throw new McpError(
          ErrorCode.InvalidParams,
          "Invalid channel ID format"
        );
      }

      // Validate thread_ts format (Unix timestamp)
      if (!thread_ts.match(/^\d+\.\d+$/)) {
        throw new McpError(
          ErrorCode.InvalidParams,
          "Invalid thread_ts format. Expected Unix timestamp (e.g., 1234567890.123456)"
        );
      }

      const response = await slack.conversations.replies({
        token,
        channel,
        ts: thread_ts,
        limit,
        oldest,
        latest,
        inclusive,
        cursor,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              messages: response.messages,
              has_more: response.has_more,
              next_cursor: response.response_metadata?.next_cursor,
            }, null, 2),
          },
        ],
      };
    } catch (error: any) {
      handleSlackError(error);
    }
  }
);

// Tool: search_messages
server.tool(
  "search_messages",
  "Search for messages in Slack",
  {
    token: tokenSchema.optional(),
    query: z.string().describe("Search query"),
    sort: z.enum(["score", "timestamp"]).optional().describe("Sort by relevance or timestamp"),
    sort_dir: z.enum(["asc", "desc"]).optional().describe("Sort direction"),
    highlight: z.boolean().optional().describe("Whether to highlight the matches"),
    count: z.number().min(1).max(100).optional().describe("Number of results to return per page"),
    page: z.number().min(1).optional().describe("Page number of results to return"),
  },
  async ({ token = SLACK_TOKEN, query, sort = "score", sort_dir = "desc", highlight = true, count = 20, page = 1 }) => {
    try {
      const response = await slack.search.messages({
        token,
        query,
        sort,
        sort_dir,
        highlight,
        count,
        page,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              messages: response.messages,
              pagination: response.messages?.pagination,
              total: response.messages?.total,
            }, null, 2),
          },
        ],
      };
    } catch (error: any) {
      handleSlackError(error);
    }
  }
);

// Resource: all_users
server.resource(
  "all_users",
  new ResourceTemplate("allusers://", { list: undefined }),
  async (uri) => {
    try {
      // Get all users (handle pagination internally)
      const allUsers: any[] = [];
      let cursor;
      let hasMore = true;

      while (hasMore) {
        const response = await slack.users.list({
          token: SLACK_TOKEN,
          limit: 1000,
          cursor,
        });

        if (response.members) {
          allUsers.push(...response.members);
        }

        cursor = response.response_metadata?.next_cursor;
        hasMore = !!cursor;
      }

      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify(allUsers, null, 2),
            mimeType: "application/json",
          },
        ],
      };
    } catch (error: any) {
      console.error("Error fetching all users:", error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to fetch all users: ${error.message || "Unknown error"}`
      );
    }
  }
);

// Resource: all_channels
server.resource(
  "all_channels",
  new ResourceTemplate("allchannels://", { list: undefined }),
  async (uri) => {
    try {
      // Get all channels (handle pagination internally)
      const allChannels: any[] = [];
      let cursor;
      let hasMore = true;

      while (hasMore) {
        const response = await slack.conversations.list({
          token: SLACK_TOKEN,
          limit: 1000,
          cursor,
          types: "public_channel,private_channel",
        });

        if (response.channels) {
          allChannels.push(...response.channels);
        }

        cursor = response.response_metadata?.next_cursor;
        hasMore = !!cursor;
      }

      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify(allChannels, null, 2),
            mimeType: "application/json",
          },
        ],
      };
    } catch (error: any) {
      console.error("Error fetching all channels:", error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to fetch all channels: ${error.message || "Unknown error"}`
      );
    }
  }
);

async function main() {
  try {
    // Validate Slack token before starting the server
    await validateSlackToken();

    // Start receiving messages on stdin and sending messages on stdout
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Slack Search MCP server running on stdio");
  } catch (error: any) {
    console.error("Failed to start MCP server:", error);
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}
