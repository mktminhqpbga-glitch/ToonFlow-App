import { Bash } from "just-bash";

export type SandboxProcessRequest = {
  command: string;
  timeoutMs: number;
  files: Record<string, string>;
  exports: string[];
};

export type SandboxProcessResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
  files: { path: string; content: string }[];
};

const maxFileBytes = 16 * 1024 * 1024;
const maxMessageBytes = 32 * 1024 * 1024;

try {
  const chunks: Buffer[] = [];
  let messageBytes = 0;
  for await (const chunk of process.stdin) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    messageBytes += buffer.byteLength;
    if (messageBytes > maxMessageBytes) throw new Error("Yêu cầu sandbox không được vượt quá 32 MiB");
    chunks.push(buffer);
  }
  const request = JSON.parse(Buffer.concat(chunks).toString("utf8")) as SandboxProcessRequest;
  const initialFiles: Record<string, Uint8Array> = Object.create(null);
  let inputBytes = 0;
  for (const [path, content] of Object.entries(request.files)) {
    const buffer = Buffer.from(content, "base64");
    inputBytes += buffer.byteLength;
    if (inputBytes > maxFileBytes) throw new Error("Tổng dung lượng tệp nhập vào sandbox không được vượt quá 16 MiB");
    initialFiles[path] = buffer;
  }
  const bash = new Bash({
    cwd: "/workspace",
    files: initialFiles,
    javascript: true,
    python: true,
    executionLimitProfile: "hardened",
    executionLimits: {
      maxExecutionTimeMs: request.timeoutMs,
      maxPythonTimeoutMs: request.timeoutMs,
      maxJsTimeoutMs: request.timeoutMs,
      maxSqliteTimeoutMs: request.timeoutMs,
      maxFileSystemBytes: 32 * 1024 * 1024,
      maxInputBytes: 32 * 1024 * 1024,
      maxLiveBytes: 64 * 1024 * 1024,
      maxSourceBytes: 1024 * 1024,
      maxOutputSize: 64 * 1024,
      maxTraversalEntries: 10000,
    },
  });
  const result = await bash.exec(request.command);
  const output: SandboxProcessResult = {
    stdout: result.stdoutKind === "bytes" ? Buffer.from(result.stdout, "latin1").toString("utf8") : result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
    files: [],
  };
  if (result.exitCode === 0) {
    let outputBytes = 0;
    for (const path of request.exports) {
      const source = `/workspace/${path}`;
      if (!(await bash.fs.stat(source)).isFile) throw new Error(`Chỉ được xuất tệp thông thường: ${path}`);
      const content = await bash.fs.readFileBuffer(source);
      outputBytes += content.byteLength;
      if (outputBytes > maxFileBytes) throw new Error("Tổng dung lượng tệp xuất từ sandbox không được vượt quá 16 MiB");
      output.files.push({ path, content: Buffer.from(content).toString("base64") });
    }
  }
  process.stdout.write(JSON.stringify(output), error => {
    if (error) {
      console.error(error.message);
      process.exit(1);
    }
    // ACT: Bun 下 Python worker 可能未自行退出；结果发送完成后结束整个沙盒进程。
    process.exit(0);
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
