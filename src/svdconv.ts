import * as exec from '@actions/exec';
import * as core from '@actions/core';

/**
 * Statistics for the number of messages printed by svdconv
 */
interface Stats {
  notes: number,
  errors: number,
  warnings: number,
}

const MESSAGE_PATTERN: RegExp = /^\*\*\* (INFO|ERROR|WARNING) (M\d+): \S+( \(Line (\d+)\))?/;

/**
 * SVDConv output message
 */
export interface Message {
  level: string, // 'info' | 'error' | 'warning',
  code: string,
  line: number,
  message: string,
}

/**
 * SVDConv result type
 */
export interface Result {
  /**
   * Line number to message list map
   */
  messages: Map<number, Array<Message>>,
  stats: Stats,
}

enum ParserState {
  // The current line is a warning/info/error message
  MESSAGE_LINE,
  // The current line is a description message
  DESCRIPTION_LINE,
  NOISE,
}

class SVDConvParser {
  /**
   * The current state of the parser
   */
  private state: ParserState;

  public stats: Stats;

  private _level: string;
  private _code: string;
  private _line: number;

  constructor() {
    this.state = ParserState.NOISE;
    this.stats = { notes: 0, warnings: 0, errors: 0 };
  }

  public parseMessage(line: string): Message | null {
    if (this.state == ParserState.NOISE && line.startsWith("***")) {
      this.state = ParserState.MESSAGE_LINE;
    }

    if (this.state == ParserState.MESSAGE_LINE) {
      const match = line.match(MESSAGE_PATTERN)!;

      this._level = match[1].toLowerCase();
      this._code = match[2];
      this._line = Number(match[4]);
      this.state = ParserState.DESCRIPTION_LINE;

      if (this._level == "info") {
        this.stats.notes += 1;
      } else if (this._level == "error") {
        this.stats.errors += 1;
      } else if (this._level == "warning") {
        this.stats.warnings += 1;
      }
    } else if (this.state == ParserState.DESCRIPTION_LINE) {
      const description = line.trim();

      this.state = ParserState.NOISE;

      return {
        level: this._level,
        code: this._code,
        line: this._line,
        message: description
      };
    }

    return null;
  }

  public async parseMessages(buffer: string): Promise<Result | null> {
    this.state = ParserState.NOISE;

    const lines = buffer.split("\n");

    let result: Result = {
      messages: new Map(),
      stats: this.stats
    };

    for (let line of lines) {
      const message = this.parseMessage(line);

      if (message) {
        let ary = result.messages.get(message.line) ?? [];

        if (ary.length == 0) {
          result.messages.set(message.line, ary);
        }

        ary.push(message);
      }
    }

    return result;
  }
}

export class SVDConv {
  private stats: Stats;
  /**
   * A list of messages for each unique line number
   */
  private messages: Map<number, Array<Message>>;
  private executable: string;

  constructor(executable: string = "SVDConv") {
    this.messages = new Map();
    this.executable = executable;
  }

  /**
   * Runs `SVDConv` with the given svd file at `path` while saving the messages.
   *
   * @returns {boolean} true if svdconv ran successfully
   */
  public async run(path: string): Promise<Result | null> {
    let stdout = '';
    let stderr = '';

    try {
      core.startGroup("Executing SVDConv");
      
      const exitCode = await exec.exec(this.executable, [path], {
        listeners: {
          stdout: (data: Buffer) => {
            stdout += data.toString();
          },
          stderr: (data: Buffer) => {
            stderr += data.toString();
          }
        },
        ignoreReturnCode: true,
        failOnStdErr: false,
      });
    } finally {
      core.endGroup();
    }

    // If there's any output on stderr, return false
    if (stderr) {
      return null;
    }

    return this.parseMessages(stdout);
  }

  /**
   * Parses the svdconv messages from the given `input` string.
   *
   * @returns {boolean} true on success, false otherwise
   */
  private async parseMessages(input: string): Promise<Result | null> {
    let parser = new SVDConvParser();
    let result = await parser.parseMessages(input);

    if (result) {
      return result;
    }

    return null;
  }
}
