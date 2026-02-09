# API

## Overview

/global/health: GET
/global/event: GET
/global/config: GET
/global/config: PATCH
/global/dispose: POST
/auth/{providerID}: PUT
/auth/{providerID}: DELETE
/project: GET
/project/current: GET
/project/{projectID}: PATCH
/pty: GET
/pty: POST
/pty/{ptyID}: GET
/pty/{ptyID}: PUT
/pty/{ptyID}: DELETE
/pty/{ptyID}/connect: GET
/config: GET
/config: PATCH
/config/providers: GET
/experimental/tool/ids: GET
/experimental/tool: GET
/experimental/worktree: POST
/experimental/worktree: GET
/experimental/worktree: DELETE
/experimental/worktree/reset: POST
/experimental/resource: GET
/session: GET
/session: POST
/session/status: GET
/session/{sessionID}: GET
/session/{sessionID}: DELETE
/session/{sessionID}: PATCH
/session/{sessionID}/children: GET
/session/{sessionID}/todo: GET
/session/{sessionID}/init: POST
/session/{sessionID}/fork: POST
/session/{sessionID}/abort: POST
/session/{sessionID}/share: POST
/session/{sessionID}/share: DELETE
/session/{sessionID}/diff: GET
/session/{sessionID}/summarize: POST
/session/{sessionID}/message: GET
/session/{sessionID}/message: POST
/session/{sessionID}/message/{messageID}: GET
/session/{sessionID}/message/{messageID}/part/{partID}: DELETE
/session/{sessionID}/message/{messageID}/part/{partID}: PATCH
/session/{sessionID}/prompt_async: POST
/session/{sessionID}/command: POST
/session/{sessionID}/shell: POST
/session/{sessionID}/revert: POST
/session/{sessionID}/unrevert: POST
/session/{sessionID}/permissions/{permissionID}: POST
/permission/{requestID}/reply: POST
/permission: GET
/question: GET
/question/{requestID}/reply: POST
/question/{requestID}/reject: POST
/provider: GET
/provider/auth: GET
/provider/{providerID}/oauth/authorize: POST
/provider/{providerID}/oauth/callback: POST
/find: GET
/find/file: GET
/find/symbol: GET
/file: GET
/file/content: GET
/file/status: GET
/mcp: GET
/mcp: POST
/mcp/{name}/auth: POST
/mcp/{name}/auth: DELETE
/mcp/{name}/auth/callback: POST
/mcp/{name}/auth/authenticate: POST
/mcp/{name}/connect: POST
/mcp/{name}/disconnect: POST
/tui/append-prompt: POST
/tui/open-help: POST
/tui/open-sessions: POST
/tui/open-themes: POST
/tui/open-models: POST
/tui/submit-prompt: POST
/tui/clear-prompt: POST
/tui/execute-command: POST
/tui/show-toast: POST
/tui/publish: POST
/tui/select-session: POST
/tui/control/next: GET
/tui/control/response: POST
/instance/dispose: POST
/path: GET
/vcs: GET
/command: GET
/log: POST
/agent: GET
/skill: GET
/lsp: GET
/formatter: GET
/event: GET

## Descriptions

GET /global/health
request:

- none
  response:
- 200: { healthy: true, version: string }
  description:
  Returns server health information.

GET /global/event
request:

- none
  response:
- 200: text/event-stream (GlobalEvent)
  description:
  Streams global events as SSE.

GET /global/config
request:

- none
  response:
- 200: Config
  description:
  Gets global configuration.

PATCH /global/config
request:

- body: Config
  response:
- 200: Config
- 400: BadRequestError
  description:
  Updates global configuration.

POST /global/dispose
request:

- none
  response:
- 200: boolean
  description:
  Disposes all instances globally.

PUT /auth/{providerID}
request:

- path.providerID: string
- body: Auth
  response:
- 200: boolean
- 400: BadRequestError
  description:
  Stores auth credentials for a provider.

DELETE /auth/{providerID}
request:

- path.providerID: string
  response:
- 200: boolean
- 400: BadRequestError
  description:
  Removes auth credentials for a provider.

GET /project
request:

- query.directory?: string
  response:
- 200: Project[]
  description:
  Lists known projects.

GET /project/current
request:

- query.directory?: string
  response:
- 200: Project
  description:
  Returns the current project.

PATCH /project/{projectID}
request:

- path.projectID: string
- query.directory?: string
- body.name?: string
- body.icon?: object
- body.commands?: object
  response:
- 200: Project
- 400: BadRequestError
- 404: NotFoundError
  description:
  Updates project metadata.

GET /pty
request:

- query.directory?: string
  response:
- 200: Pty[]
  description:
  Lists PTY sessions.

POST /pty
request:

- query.directory?: string
- body.command?: string
- body.args?: string[]
- body.cwd?: string
- body.env?: object
- body.title?: string
  response:
- 200: Pty
- 400: BadRequestError
  description:
  Creates a PTY session.

GET /pty/{ptyID}
request:

- path.ptyID: string
- query.directory?: string
  response:
- 200: Pty
- 404: NotFoundError
  description:
  Gets a PTY session.

PUT /pty/{ptyID}
request:

- path.ptyID: string
- query.directory?: string
- body.title?: string
- body.size?: { rows: number, cols: number }
  response:
- 200: Pty
- 400: BadRequestError
  description:
  Updates a PTY session.

DELETE /pty/{ptyID}
request:

- path.ptyID: string
- query.directory?: string
  response:
- 200: boolean
- 404: NotFoundError
  description:
  Removes a PTY session.

GET /pty/{ptyID}/connect
request:

- path.ptyID: string
- query.directory?: string
  response:
- 200: boolean
- 404: NotFoundError
  description:
  Connects to a PTY session.

GET /config
request:

- query.directory?: string
  response:
- 200: Config
  description:
  Gets project configuration.

PATCH /config
request:

- query.directory?: string
- body: Config
  response:
- 200: Config
- 400: BadRequestError
  description:
  Updates project configuration.

GET /config/providers
request:

- query.directory?: string
  response:
- 200: object
  description:
  Lists configured providers.

GET /experimental/tool/ids
request:

- query.directory?: string
  response:
- 200: string[]
- 400: BadRequestError
  description:
  Lists available tool IDs.

GET /experimental/tool
request:

- query.directory?: string
- query.provider: string
- query.model: string
  response:
- 200: ToolList
- 400: BadRequestError
  description:
  Lists tools and their parameter schemas.

POST /experimental/worktree
request:

- query.directory?: string
- body: WorktreeCreateInput
  response:
- 200: Worktree
- 400: BadRequestError
  description:
  Creates a worktree and runs startup.

GET /experimental/worktree
request:

- query.directory?: string
  response:
- 200: Worktree[]
  description:
  Lists worktrees.

DELETE /experimental/worktree
request:

- query.directory?: string
- body: WorktreeRemoveInput
  response:
- 200: boolean
- 400: BadRequestError
  description:
  Removes a worktree.

POST /experimental/worktree/reset
request:

- query.directory?: string
- body: WorktreeResetInput
  response:
- 200: boolean
- 400: BadRequestError
  description:
  Resets a worktree to the default branch.

GET /experimental/resource
request:

- query.directory?: string
  response:
- 200: object
  description:
  Lists MCP resources.

GET /session
request:

- query.directory?: string
- query.limit?: number
- query.roots?: string[]
- query.search?: string
- query.start?: string
  response:
- 200: Session[]
  description:
  Lists sessions.

POST /session
request:

- query.directory?: string
- body.title?: string
- body.parentID?: string
- body.permission?: object
  response:
- 200: Session
- 400: BadRequestError
  description:
  Creates a session.

GET /session/status
request:

- query.directory?: string
  response:
- 200: object
- 400: BadRequestError
  description:
  Lists session status entries.

GET /session/{sessionID}
request:

- path.sessionID: string
- query.directory?: string
  response:
- 200: Session
- 400: BadRequestError
- 404: NotFoundError
  description:
  Gets a session by ID.

DELETE /session/{sessionID}
request:

- path.sessionID: string
- query.directory?: string
  response:
- 200: boolean
- 400: BadRequestError
- 404: NotFoundError
  description:
  Deletes a session.

PATCH /session/{sessionID}
request:

- path.sessionID: string
- query.directory?: string
- body.title?: string
- body.time?: object
  response:
- 200: Session
- 400: BadRequestError
- 404: NotFoundError
  description:
  Updates session metadata.

GET /session/{sessionID}/children
request:

- path.sessionID: string
- query.directory?: string
  response:
- 200: Session[]
- 400: BadRequestError
- 404: NotFoundError
  description:
  Lists child sessions.

GET /session/{sessionID}/todo
request:

- path.sessionID: string
- query.directory?: string
  response:
- 200: Todo[]
- 400: BadRequestError
- 404: NotFoundError
  description:
  Lists todos for the session.

POST /session/{sessionID}/init
request:

- path.sessionID: string
- query.directory?: string
- body.providerID?: string
- body.modelID?: string
- body.messageID?: string
  response:
- 200: boolean
- 400: BadRequestError
- 404: NotFoundError
  description:
  Initializes a session.

POST /session/{sessionID}/fork
request:

- path.sessionID: string
- query.directory?: string
- body.messageID?: string
  response:
- 200: Session
  description:
  Forks a session.

POST /session/{sessionID}/abort
request:

- path.sessionID: string
- query.directory?: string
  response:
- 200: boolean
- 400: BadRequestError
- 404: NotFoundError
  description:
  Aborts a running session.

POST /session/{sessionID}/share
request:

- path.sessionID: string
- query.directory?: string
  response:
- 200: Session
- 400: BadRequestError
- 404: NotFoundError
  description:
  Creates a share link for the session.

DELETE /session/{sessionID}/share
request:

- path.sessionID: string
- query.directory?: string
  response:
- 200: Session
- 400: BadRequestError
- 404: NotFoundError
  description:
  Removes a share link for the session.

GET /session/{sessionID}/diff
request:

- path.sessionID: string
- query.directory?: string
- query.messageID?: string
  response:
- 200: FileDiff[]
  description:
  Returns the diff for a message.

POST /session/{sessionID}/summarize
request:

- path.sessionID: string
- query.directory?: string
- body.auto?: boolean
- body.providerID?: string
- body.modelID?: string
  response:
- 200: boolean
- 400: BadRequestError
- 404: NotFoundError
  description:
  Generates a session summary.

GET /session/{sessionID}/message
request:

- path.sessionID: string
- query.directory?: string
- query.limit?: number
  response:
- 200: Message[]
- 400: BadRequestError
- 404: NotFoundError
  description:
  Lists messages in a session.

POST /session/{sessionID}/message
request:

- path.sessionID: string
- query.directory?: string
- body.messageID?: string
- body.parts?: PartInput[]
- body.tools?: object
- body.agent?: string
- body.model?: object
- body.system?: string
- body.noReply?: boolean
- body.variant?: string
  response:
- 200: object
- 400: BadRequestError
- 404: NotFoundError
  description:
  Creates a message in a session.

GET /session/{sessionID}/message/{messageID}
request:

- path.sessionID: string
- path.messageID: string
- query.directory?: string
  response:
- 200: Message
- 400: BadRequestError
- 404: NotFoundError
  description:
  Gets a message by ID.

DELETE /session/{sessionID}/message/{messageID}/part/{partID}
request:

- path.sessionID: string
- path.messageID: string
- path.partID: string
- query.directory?: string
  response:
- 200: boolean
- 400: BadRequestError
- 404: NotFoundError
  description:
  Deletes a message part.

PATCH /session/{sessionID}/message/{messageID}/part/{partID}
request:

- path.sessionID: string
- path.messageID: string
- path.partID: string
- query.directory?: string
- body: Part
  response:
- 200: Part
- 400: BadRequestError
- 404: NotFoundError
  description:
  Updates a message part.

POST /session/{sessionID}/prompt_async
request:

- path.sessionID: string
- query.directory?: string
- body.messageID?: string
- body.parts?: PartInput[]
- body.tools?: object
- body.agent?: string
- body.model?: object
- body.system?: string
- body.noReply?: boolean
- body.variant?: string
  response:
- 204: none
- 400: BadRequestError
- 404: NotFoundError
  description:
  Sends a message asynchronously.

POST /session/{sessionID}/command
request:

- path.sessionID: string
- query.directory?: string
- body.command: string
- body.arguments?: string
- body.messageID?: string
- body.parts?: PartInput[]
- body.agent?: string
- body.model?: object
- body.variant?: string
  response:
- 200: object
- 400: BadRequestError
- 404: NotFoundError
  description:
  Executes a command in a session.

POST /session/{sessionID}/shell
request:

- path.sessionID: string
- query.directory?: string
- body.command: string
- body.agent?: string
- body.model?: object
  response:
- 200: AssistantMessage
- 400: BadRequestError
- 404: NotFoundError
  description:
  Runs a shell command in a session.

POST /session/{sessionID}/revert
request:

- path.sessionID: string
- query.directory?: string
- body.messageID?: string
- body.partID?: string
  response:
- 200: Session
- 400: BadRequestError
- 404: NotFoundError
  description:
  Reverts a message or part.

POST /session/{sessionID}/unrevert
request:

- path.sessionID: string
- query.directory?: string
  response:
- 200: Session
- 400: BadRequestError
- 404: NotFoundError
  description:
  Restores reverted messages.

POST /session/{sessionID}/permissions/{permissionID}
request:

- path.sessionID: string
- path.permissionID: string
- query.directory?: string
- body.response: string
  response:
- 200: boolean
- 400: BadRequestError
- 404: NotFoundError
  description:
  Replies to a permission request.

POST /permission/{requestID}/reply
request:

- path.requestID: string
- query.directory?: string
- body.reply: string
- body.message?: string
  response:
- 200: boolean
- 400: BadRequestError
- 404: NotFoundError
  description:
  Replies to a permission request by request ID.

GET /permission
request:

- query.directory?: string
  response:
- 200: Permission[]
  description:
  Lists pending permission requests.

GET /question
request:

- query.directory?: string
  response:
- 200: Question[]
  description:
  Lists pending questions.

POST /question/{requestID}/reply
request:

- path.requestID: string
- query.directory?: string
- body.answers: string[]
  response:
- 200: boolean
- 400: BadRequestError
- 404: NotFoundError
  description:
  Replies to a question request.

POST /question/{requestID}/reject
request:

- path.requestID: string
- query.directory?: string
  response:
- 200: boolean
- 400: BadRequestError
- 404: NotFoundError
  description:
  Rejects a question request.

GET /provider
request:

- query.directory?: string
  response:
- 200: object
  description:
  Lists providers.

GET /provider/auth
request:

- query.directory?: string
  response:
- 200: object
  description:
  Lists provider auth methods.

POST /provider/{providerID}/oauth/authorize
request:

- path.providerID: string
- query.directory?: string
- body.method?: string
  response:
- 200: ProviderAuthAuthorization
- 400: BadRequestError
  description:
  Starts OAuth authorization.

POST /provider/{providerID}/oauth/callback
request:

- path.providerID: string
- query.directory?: string
- body.method?: string
- body.code?: string
  response:
- 200: boolean
- 400: BadRequestError
  description:
  Handles OAuth callback.

GET /find
request:

- query.directory?: string
- query.pattern: string
  response:
- 200: array
  description:
  Searches text with a regex pattern.

GET /find/file
request:

- query.directory?: string
- query.query: string
- query.type?: string
- query.dirs?: string[]
- query.limit?: number
  response:
- 200: array
  description:
  Searches files by name.

GET /find/symbol
request:

- query.directory?: string
- query.query: string
  response:
- 200: array
  description:
  Searches workspace symbols.

GET /file
request:

- query.directory?: string
- query.path: string
  response:
- 200: FileNode[]
  description:
  Lists files under a path.

GET /file/content
request:

- query.directory?: string
- query.path: string
  response:
- 200: FileContent
  description:
  Reads file content.

GET /file/status
request:

- query.directory?: string
  response:
- 200: FileStatus[]
  description:
  Returns file status information.

GET /mcp
request:

- query.directory?: string
  response:
- 200: object
  description:
  Returns MCP status.

POST /mcp
request:

- query.directory?: string
- body.name: string
- body.config: object
  response:
- 200: object
- 400: BadRequestError
  description:
  Adds an MCP server.

POST /mcp/{name}/auth
request:

- path.name: string
- query.directory?: string
  response:
- 200: object
- 400: BadRequestError
- 404: NotFoundError
  description:
  Starts MCP OAuth.

DELETE /mcp/{name}/auth
request:

- path.name: string
- query.directory?: string
  response:
- 200: object
- 404: NotFoundError
  description:
  Removes MCP OAuth credentials.

POST /mcp/{name}/auth/callback
request:

- path.name: string
- query.directory?: string
- body.code: string
  response:
- 200: McpStatus
- 400: BadRequestError
- 404: NotFoundError
  description:
  Completes MCP OAuth.

POST /mcp/{name}/auth/authenticate
request:

- path.name: string
- query.directory?: string
  response:
- 200: McpStatus
- 400: BadRequestError
- 404: NotFoundError
  description:
  Starts MCP auth flow and waits for callback.

POST /mcp/{name}/connect
request:

- path.name: string
- query.directory?: string
  response:
- 200: boolean
  description:
  Connects an MCP server.

POST /mcp/{name}/disconnect
request:

- path.name: string
- query.directory?: string
  response:
- 200: boolean
  description:
  Disconnects an MCP server.

POST /tui/append-prompt
request:

- query.directory?: string
- body.text: string
  response:
- 200: boolean
- 400: BadRequestError
  description:
  Appends text to the TUI prompt.

POST /tui/open-help
request:

- query.directory?: string
  response:
- 200: boolean
  description:
  Opens the help dialog.

POST /tui/open-sessions
request:

- query.directory?: string
  response:
- 200: boolean
  description:
  Opens the sessions dialog.

POST /tui/open-themes
request:

- query.directory?: string
  response:
- 200: boolean
  description:
  Opens the themes dialog.

POST /tui/open-models
request:

- query.directory?: string
  response:
- 200: boolean
  description:
  Opens the models dialog.

POST /tui/submit-prompt
request:

- query.directory?: string
  response:
- 200: boolean
  description:
  Submits the current prompt.

POST /tui/clear-prompt
request:

- query.directory?: string
  response:
- 200: boolean
  description:
  Clears the current prompt.

POST /tui/execute-command
request:

- query.directory?: string
- body.command: string
  response:
- 200: boolean
- 400: BadRequestError
  description:
  Executes a TUI command.

POST /tui/show-toast
request:

- query.directory?: string
- body.title?: string
- body.message: string
- body.duration?: number
- body.variant: info | success | warning | error
  response:
- 200: boolean
  description:
  Shows a toast in the TUI.

POST /tui/publish
request:

- query.directory?: string
- body: object
  response:
- 200: boolean
- 400: BadRequestError
  description:
  Publishes a TUI event.

POST /tui/select-session
request:

- query.directory?: string
- body.sessionID: string
  response:
- 200: boolean
- 400: BadRequestError
- 404: NotFoundError
  description:
  Selects a session in the TUI.

GET /tui/control/next
request:

- query.directory?: string
  response:
- 200: object
  description:
  Gets the next TUI control request.

POST /tui/control/response
request:

- query.directory?: string
  response:
- 200: boolean
  description:
  Sends a TUI control response.

POST /instance/dispose
request:

- query.directory?: string
  response:
- 200: boolean
  description:
  Disposes the current instance.

GET /path
request:

- query.directory?: string
  response:
- 200: Path
  description:
  Returns path information.

GET /vcs
request:

- query.directory?: string
  response:
- 200: VcsInfo
  description:
  Returns VCS information.

GET /command
request:

- query.directory?: string
  response:
- 200: Command[]
  description:
  Lists available commands.

POST /log
request:

- query.directory?: string
- body.level: string
- body.message: string
- body.service?: string
- body.extra?: object
  response:
- 200: boolean
- 400: BadRequestError
  description:
  Writes a log entry.

GET /agent
request:

- query.directory?: string
  response:
- 200: Agent[]
  description:
  Lists agents.

GET /skill
request:

- query.directory?: string
  response:
- 200: Skill[]
  description:
  Lists skills.

GET /lsp
request:

- query.directory?: string
  response:
- 200: LspStatus[]
  description:
  Lists LSP status.

GET /formatter
request:

- query.directory?: string
  response:
- 200: FormatterStatus[]
  description:
  Lists formatter status.

GET /event
request:

- query.directory?: string
  response:
- 200: text/event-stream (Event)
  description:
  Streams project events as SSE.
