# read

## 1. Input

- `filePath`: Path of the file to read.
- `offset`: Start line (0-based, optional).
- `limit`: Number of lines to read (default 2000).

## 2. Output

- `title`: Workspace-relative file path.
- `output`: File content with line numbers in a `<file>` block.
- `metadata.preview`: Short preview string.
- `metadata.truncated`: Whether output was truncated.
- `metadata.loaded[]`: Additional instruction files loaded (if any).
- `attachments[]`: File parts for images/PDFs.

## 3. JSON Example

```json
{
  "filePath": "/path/to/project/src/main.ts",
  "offset": 0,
  "limit": 200
}
```

## 4. Notes

- Image/PDF reads return attachments instead of text.
- There are per-line and total-size output limits.
