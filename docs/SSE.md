# SSE

## Event Envelope
Each SSE message uses a single `data:` line containing a JSON object:

```text
data: {"directory":"/abs/or/relative/path","payload":{"type":"...","properties":{...}}}

```

Common fields:
- directory: Workspace directory the event belongs to.
- payload.type: Event type name.
- payload.properties: Event-specific data.

## Event Types
Below lists each `payload.type` and its `properties` fields.

- server.instance.disposed
  - directory: string
- installation.updated
  - version: string
- installation.update-available
  - version: string
- lsp.client.diagnostics
  - serverID: string
  - path: string
- lsp.updated
  - (arbitrary fields)
- message.updated
  - info: Message
- message.removed
  - sessionID: string
  - messageID: string
- message.part.updated
  - part: Part
  - delta?: string
- message.part.removed
  - sessionID: string
  - messageID: string
  - partID: string
- permission.updated
  - id: string
  - type: string
  - pattern?: string | string[]
  - sessionID: string
  - messageID: string
  - callID?: string
  - title: string
  - metadata: object
  - time.created: number
- permission.replied
  - sessionID: string
  - permissionID: string
  - response: string
- session.status
  - sessionID: string
  - status.type: idle | retry | busy
  - status.attempt?: number
  - status.message?: string
  - status.next?: number
- session.idle
  - sessionID: string
- session.compacted
  - sessionID: string
- file.edited
  - file: string
- todo.updated
  - sessionID: string
  - todos: Todo[]
- command.executed
  - name: string
  - sessionID: string
  - arguments: string
  - messageID: string
- session.created
  - info: Session
- session.updated
  - info: Session
- session.deleted
  - info: Session
- session.diff
  - sessionID: string
  - diff: FileDiff[]
- session.error
  - sessionID?: string
  - error?: ProviderAuthError | UnknownError | MessageOutputLengthError | MessageAbortedError | ApiError
- file.watcher.updated
  - file: string
  - event: add | change | unlink
- vcs.branch.updated
  - branch?: string
- tui.prompt.append
  - text: string
- tui.command.execute
  - command: string
- tui.toast.show
  - title?: string
  - message: string
  - variant: info | success | warning | error
  - duration?: number
- pty.created
  - info: Pty
- pty.updated
  - info: Pty
- pty.exited
  - id: string
  - exitCode: number
- pty.deleted
  - id: string
- server.connected
  - (arbitrary fields)

## Core Payload Shapes
These are the main object shapes referenced above.

Message
- id: string
- sessionID: string
- role: user | assistant
- time.created: number
- time.completed?: number
- summary?.title?: string
- summary?.body?: string
- summary?.diffs: FileDiff[]
- agent: string
- model.providerID: string
- model.modelID: string
- error?: ProviderAuthError | UnknownError | MessageOutputLengthError | MessageAbortedError | ApiError

Part
- type: text | reasoning | file | tool | step-start | step-finish | snapshot | patch | agent | retry | compaction | subtask
- id: string
- sessionID: string
- messageID: string
- text?: string
- tool?: string
- state?: ToolState
- snapshot?: string
- hash?: string
- files?: string[]
- delta?: string (only on message.part.updated)

ToolState
- status: pending | running | completed | error
- input: object
- raw?: string
- title?: string
- metadata?: object
- output?: string
- error?: string
- time.start?: number
- time.end?: number
- attachments?: FilePart[]

FilePart
- id: string
- sessionID: string
- messageID: string
- type: file
- mime: string
- filename?: string
- url: string
- source?: FileSource | SymbolSource

FileSource
- type: file
- path: string
- text.value: string
- text.start: number
- text.end: number

SymbolSource
- type: symbol
- path: string
- name: string
- kind: number
- range.start.line: number
- range.start.character: number
- range.end.line: number
- range.end.character: number
- text.value: string
- text.start: number
- text.end: number

FileDiff
- file: string
- before: string
- after: string
- additions: number
- deletions: number

Session
- id: string
- projectID: string
- directory: string
- parentID?: string
- title: string
- version: string
- time.created: number
- time.updated: number
- time.compacting?: number
- summary?.additions: number
- summary?.deletions: number
- summary?.files: number
- summary?.diffs?: FileDiff[]
- share?.url?: string
- revert?.messageID?: string
- revert?.partID?: string
- revert?.snapshot?: string
- revert?.diff?: string

Todo
- content: string
- status: pending | in_progress | completed | cancelled
- priority: high | medium | low
- id: string

Pty
- id: string
- title: string
- command: string
- args: string[]
- cwd: string
- status: running | exited
- pid: number

ProviderAuthError
- name: ProviderAuthError
- data.providerID: string
- data.message: string

UnknownError
- name: UnknownError
- data.message: string

MessageOutputLengthError
- name: MessageOutputLengthError
- data: object

MessageAbortedError
- name: MessageAbortedError
- data.message: string

ApiError
- name: APIError
- data.message: string
- data.statusCode?: number
- data.isRetryable: boolean
- data.responseHeaders?: object
- data.responseBody?: string
