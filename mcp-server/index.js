import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import dotenv from "dotenv";
import path from "path";

// Load environment variables
dotenv.config();

const backendUrl = (process.env.BACKEND_URL || "http://localhost:4000").replace(/\/$/, "");
const apiToken = process.env.NEXUS_API_TOKEN || "";
const email = process.env.NEXUS_EMAIL || "";
const password = process.env.NEXUS_PASSWORD || "";

let accessToken = apiToken;
let tokenExpiresAt = apiToken ? Date.now() + 365 * 24 * 60 * 60 * 1000 : 0; // If token is provided, assume it's long-lived

// Helper function to handle authentication and return headers
async function getAuthHeaders() {
  // If there's no pre-configured API Token and we have credentials, try to log in
  if (!accessToken) {
    if (email && password) {
      const now = Date.now();
      if (now >= tokenExpiresAt) {
        await login();
      }
    } else {
      throw new Error("Authentication failed: Neither NEXUS_API_TOKEN nor NEXUS_EMAIL/NEXUS_PASSWORD is provided in .env");
    }
  }
  return {
    "Authorization": `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

// Login to acquire JWT token (fallback mode)
async function login() {
  console.error(`Attempting fallback login to backend at ${backendUrl}...`);
  try {
    const response = await fetch(`${backendUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      throw new Error(`Login failed with HTTP status ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.access_token) {
      throw new Error("Login response did not contain access_token");
    }

    accessToken = data.access_token;
    // Refresh local token after 1 day
    tokenExpiresAt = Date.now() + 24 * 60 * 60 * 1000;
    console.error("Successfully logged in. Fallback JWT token acquired.");
  } catch (error) {
    console.error("Authentication error:", error.message);
    throw error;
  }
}

const server = new Server(
  {
    name: "nexusai-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list_projects",
        description: "List all projects in the NexusAI management system that the current user has access to",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "get_project_details",
        description: "Get detailed information about a specific project including member and task statistics",
        inputSchema: {
          type: "object",
          properties: {
            projectId: {
              type: "number",
              description: "The unique ID of the project",
            },
          },
          required: ["projectId"],
        },
      },
      {
        name: "list_tasks",
        description: "List all tasks for a specific project, optionally filtered by status",
        inputSchema: {
          type: "object",
          properties: {
            projectId: {
              type: "number",
              description: "The unique ID of the project",
            },
            status: {
              type: "string",
              description: "Filter tasks by status (e.g., TODO, IN_PROGRESS, DONE)",
            },
          },
          required: ["projectId"],
        },
      },
      {
        name: "list_documents",
        description: "List all uploaded documents/requirements files for a project",
        inputSchema: {
          type: "object",
          properties: {
            projectId: {
              type: "number",
              description: "The unique ID of the project",
            },
          },
          required: ["projectId"],
        },
      },
      {
        name: "read_document",
        description: "Read the content of a text-based document (Markdown, TXT, JSON) by its ID",
        inputSchema: {
          type: "object",
          properties: {
            projectId: {
              type: "number",
              description: "The project ID the document belongs to",
            },
            documentId: {
              type: "number",
              description: "The unique ID of the document (obtainable from list_documents)",
            },
          },
          required: ["projectId", "documentId"],
        },
      },
    ],
  };
});

// Handle tool executions
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const headers = await getAuthHeaders();

    if (name === "list_projects") {
      const response = await fetch(`${backendUrl}/api/projects`, { headers });
      if (!response.ok) {
        throw new Error(`Failed to fetch projects. Status ${response.status}: ${response.statusText}`);
      }
      const projects = await response.json();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(projects, null, 2),
          },
        ],
      };
    }

    if (name === "get_project_details") {
      const { projectId } = args;
      const response = await fetch(`${backendUrl}/api/projects/${projectId}`, { headers });
      
      if (!response.ok) {
        if (response.status === 404) {
          return {
            content: [{ type: "text", text: `Project with ID ${projectId} not found.` }],
            isError: true,
          };
        }
        throw new Error(`Failed to fetch project details. Status ${response.status}`);
      }
      
      const project = await response.json();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(project, null, 2),
          },
        ],
      };
    }

    if (name === "list_tasks") {
      const { projectId, status } = args;
      const response = await fetch(`${backendUrl}/api/projects/${projectId}/tasks?take=1000`, { headers });
      if (!response.ok) {
        throw new Error(`Failed to fetch tasks. Status ${response.status}`);
      }

      const tasksData = await response.json();
      let tasks = tasksData.data || tasksData;

      if (status && Array.isArray(tasks)) {
        tasks = tasks.filter((t) => t.status?.toUpperCase() === status.toUpperCase());
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(tasks, null, 2),
          },
        ],
      };
    }

    if (name === "list_documents") {
      const { projectId } = args;
      const response = await fetch(`${backendUrl}/api/projects/${projectId}/documents?take=1000`, { headers });
      if (!response.ok) {
        throw new Error(`Failed to fetch documents. Status ${response.status}`);
      }

      const docsData = await response.json();
      const docs = docsData.data || docsData;

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(docs, null, 2),
          },
        ],
      };
    }

    if (name === "read_document") {
      const { projectId, documentId } = args;

      // 1. Fetch document metadata to find the file download url
      const docsResponse = await fetch(`${backendUrl}/api/projects/${projectId}/documents?take=1000`, { headers });
      if (!docsResponse.ok) {
        throw new Error(`Failed to fetch project documents list. Status ${docsResponse.status}`);
      }

      const docsData = await docsResponse.json();
      const docsList = docsData.data || docsData;
      
      const doc = Array.isArray(docsList) 
        ? docsList.find((d) => d.id === documentId) 
        : null;

      if (!doc) {
        return {
          content: [{ type: "text", text: `Document with ID ${documentId} not found in project ${projectId}.` }],
          isError: true,
        };
      }

      const ext = path.extname(doc.originalName || doc.filename || "").toLowerCase();
      const textExtensions = [".txt", ".md", ".json", ".csv", ".xml", ".html", ".js", ".ts"];

      if (!textExtensions.includes(ext)) {
        return {
          content: [
            {
              type: "text",
              text: `Cannot read binary file contents directly. Format: ${ext}. Original Name: ${doc.originalName}. Download URL: ${doc.url}`,
            },
          ],
        };
      }

      if (!doc.url) {
        return {
          content: [{ type: "text", text: "Document metadata does not contain a valid URL." }],
          isError: true,
        };
      }

      // 2. Fetch the file content from the URL
      console.error(`Fetching document content from URL: ${doc.url}`);
      try {
        const fileResponse = await fetch(doc.url, { headers });
        if (!fileResponse.ok) {
          throw new Error(`HTTP error! Status: ${fileResponse.status}`);
        }
        const content = await fileResponse.text();
        return {
          content: [
            {
              type: "text",
              text: content,
            },
          ],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Failed to download file from URL (${doc.url}): ${err.message}` }],
          isError: true,
        };
      }
    }

    return {
      content: [{ type: "text", text: `Unknown tool: ${name}` }],
      isError: true,
    };
  } catch (error) {
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

// Run server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("NexusAI User Token-based MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main:", error);
  process.exit(1);
});
