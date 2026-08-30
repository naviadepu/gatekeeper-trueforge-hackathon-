/**
 * Hand-written subset of the TrueForge HTTP API (`/api/v1`) — only the shapes
 * Gatekeeper actually reads. Full spec: GET {TRUEFORGE_URL}/api/v1/openapi.json
 * or the Swagger UI at {TRUEFORGE_URL}/api/v1/docs.
 */

// ---- session / turn creation ---------------------------------------------

export type ToolSelector = "@all" | "@read-only" | "@write" | "@destructive" | (string & {});

export interface McpServerRef {
  name: string;
  enable_tools?: ToolSelector[];
  disable_tools?: ToolSelector[];
  require_approval_for_tools?: ToolSelector[];
  /** Load all (enabled) tool schemas upfront instead of deferred discovery. */
  preload?: boolean;
}

export interface AgentSpec {
  model: { name: string; params?: Record<string, unknown> };
  instructions?: string;
  mcp_servers?: McpServerRef[];
  response_format?:
    | { type: "text" }
    | { type: "json_object" }
    | {
        type: "json_schema";
        json_schema: { name: string; description?: string; schema: Record<string, unknown>; strict?: boolean };
      };
  config?: {
    iteration_limit?: number;
    sandbox?: { enabled: boolean; file_downloads?: boolean };
    dynamic_sub_agents?: { enabled: boolean };
  };
}

export interface CreateSessionResponse {
  data: { id: string; created_at: string };
}

// A user message, or a resume after an approval / tool-response pause.
export type TurnInputItem =
  | { type: "user.message"; content: string }
  | {
      type: "user.tool_approval";
      thread_id: string;
      tool_call_id: string;
      approval: { status: "allow" } | { status: "deny"; reason?: string };
    }
  | { type: "user.tool_response"; thread_id: string; tool_call_id: string; content: string };

export interface CreateTurnRequest {
  input: TurnInputItem[];
  previous_turn_id?: "auto" | "none" | string;
  stream?: boolean;
}

// ---- streamed turn events (SSE `data:` payloads) -------------------------

export interface RawToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
  tool_info?:
    | { type: "truefoundry-system"; name: string }
    | { type: "mcp"; server_name: string; name: string };
}

export interface ModelMessageEvent {
  type: "model.message";
  id: string;
  thread_id: string;
  content: string | Array<{ type: string; text?: string }> | null;
  tool_calls?: RawToolCall[];
  finish_reason?: string | null;
  created_at: string;
}

/**
 * Streaming delta of a `model.message`. Tool calls arrive here incrementally:
 * the first delta for a call carries `index` + `id` + `function.name`, later
 * deltas append `function.arguments` chunks. `finish_reason: "tool_calls"`
 * marks the message's calls complete.
 */
export interface ModelMessageDeltaEvent {
  type: "model.message.delta";
  id: string;
  thread_id: string;
  content?: string | null;
  tool_calls?: Array<{
    index: number;
    id?: string;
    type?: "function";
    function?: { name?: string; arguments?: string };
    tool_info?: RawToolCall["tool_info"];
  }>;
  finish_reason?: string | null;
}

export interface ToolResponseEvent {
  type: "tool.response";
  id: string;
  thread_id: string;
  tool_call_id: string;
  content: string;
  created_at: string;
}

export interface ToolApprovalRequiredEvent {
  type: "tool.approval_required";
  id: string;
  thread_id: string;
  tool_calls: Array<{ id: string; source_event_id: string }>;
  created_at: string;
}

export interface SandboxCreatedEvent {
  type: "sandbox.created";
  id: string;
  sandbox_id: string;
  created_at: string;
}

export interface TurnCreatedEvent {
  type: "turn.created";
  id: string;
  turn_id: string;
  created_at: string;
}

export type TurnStateTerminal =
  | {
      status: "done";
      output: ModelMessageEvent | null;
      required_actions: Array<{ type: string; thread_id?: string; tool_calls?: Array<{ id: string }> }>;
      completed_at: string;
    }
  | { status: "error"; message: string; completed_at: string }
  | { status: "cancelled"; reason: string; completed_at: string };

export interface TurnDoneEvent {
  type: "turn.done";
  id: string;
  state: TurnStateTerminal;
  created_at: string;
}

export interface ThreadCreatedEvent {
  type: "thread.created";
  id: string;
  thread_id: string;
  title: string;
  agent_info?: { name?: string };
  created_at: string;
}

export type TurnStreamEvent =
  | TurnCreatedEvent
  | SandboxCreatedEvent
  | ModelMessageEvent
  | ModelMessageDeltaEvent
  | ToolResponseEvent
  | ToolApprovalRequiredEvent
  | ThreadCreatedEvent
  | TurnDoneEvent
  | { type: string; [k: string]: unknown };
