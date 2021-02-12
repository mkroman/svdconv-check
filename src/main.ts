import * as tc from '@actions/tool-cache';
import * as core from '@actions/core';
import * as github from '@actions/github';
import * as path from 'path';
import * as fs from 'fs';
import { SVDConv, Message, Result } from './svdconv';

const SVDCONV_VERSION: string = '3.3.35';

interface CheckOptions {
    token: string,
    owner: string,
    repo: string,
    name: string,
    head_sha: string,
    started_at: string, // ISO8601
}

/// Attempts to download the SVDConv tool and returns the path to it
async function install(): Promise<string> {
  let svdConvPath: string = '';
  let cachedPath: string = '';

  let executableName = 'SVDConv';
  let url = '';

  if (process.platform != 'win32' && process.platform != 'linux') {
    core.setFailed(`Unsupported platform ${process.platform}`);

    throw new Error(`Unsupported platform ${process.platform}`);
  }

  if (process.platform == 'linux') {
    url = 'https://github.com/ARM-software/CMSIS_5/raw/4b069d7bcb9ea77251ae2283db2ee650767f0f50/CMSIS/Utilities/Linux64/SVDConv';
  } else if (process.platform == 'win32') {
    executableName = 'SVDConv.exe';
    url = 'https://github.com/ARM-software/CMSIS_5/blob/4b069d7bcb9ea77251ae2283db2ee650767f0f50/CMSIS/Utilities/Win32/SVDConv.exe';
  }

  cachedPath = tc.find(executableName, SVDCONV_VERSION);

  if (cachedPath == '') {
    svdConvPath = await tc.downloadTool(url);
    fs.chmodSync(svdConvPath, 0o775);

    cachedPath = await tc.cacheFile(svdConvPath, executableName, 'SVDConv', SVDCONV_VERSION);
  }

  return path.join(cachedPath, executableName);
}

/**
 * Returns a list of up to 50 annotations directly from a map of messages
 */
function getAnnotations(svdPath: string, messages: Map<number, Array<Message>>): Array<any> | null {
  let annotations: Array<any> = [];

  // Horribly inefficient method of getting a bucket of 50 annotations, but
  // clippy-check does something similar, so whatever.
  while (annotations.length < 50 && messages.size > 0) {
    let key = messages.keys().next()?.value;

    if (key !== undefined) {
      let ary = messages.get(key);
      let msg = ary?.pop();

      if (msg) {
        let annotation_level;
        let start_line = isNaN(key) ? 0 : key;
        let end_line = start_line;

        if (msg.level == "info") {
          annotation_level = "notice";
        } else if (msg.level == "warning") {
          annotation_level = "warning";
        } else {
          annotation_level = "error";
        }

        let message = `${msg.code}: ${msg.message}`;

        annotations.push({
          path: svdPath,
          start_line,
          end_line,
          annotation_level,
          message,
        });
      }

      if (ary?.length == 0) {
        messages.delete(key);
      }
    } else {
      break;
    }
  }

  return annotations.length == 0 ? null : annotations;
}

async function uploadResult(result: Result, svdPath: string, options: CheckOptions): Promise<void> {
  const client = github.getOctokit(options.token);

  core.debug("Creating check-run");

  const response = await client.checks.create({
    owner: options.owner,
    repo: options.repo,
    name: options.name,
    head_sha: options.head_sha,
    status: 'in_progress',
  });
 
  const checkRunId: number = response.data.id;

  try {
    while (result.messages.size > 0) {
        let bucket = getAnnotations(svdPath, result.messages);

        if (!bucket) {
          break;
        }

        // Update the check-run
        await client.checks.update({
            owner: options.owner,
            repo: options.repo,
            name: options.name,
            check_run_id: checkRunId,
            status: 'in_progress',
            output: {
                title: options.name,
                summary: "ohai",
                text: "hello world",
                annotations: bucket,
            }
        });
    }

    await client.checks.update({
        owner: options.owner,
        repo: options.repo,
        name: options.name,
        check_run_id: checkRunId,
        status: 'completed',
        completed_at: new Date().toISOString(),
        conclusion: 'neutral',
        output: {
            title: options.name,
            summary: "ohai",
            text: "hello world - completed",
        }
    });

  } catch (error) {
    // Cancel the run-check
    await client.checks.update({
        owner: options.owner,
        repo: options.repo,
        name: options.name,
        check_run_id: checkRunId,
        status: 'completed',
        conclusion: 'cancelled',
        completed_at: new Date().toISOString(),
        output: {
            title: options.name,
            summary: 'Unhandled error',
            text: 'Check was cancelled due to unhandled error. Check the Action logs for details.',
        }
    });
  }

}

async function main(): Promise<void> {
  const svdConvPath = await install();
  const svdConvDir = path.dirname(svdConvPath);
  const svdConvExe = path.basename(svdConvPath);

  core.addPath(svdConvDir);

  const startedAt = new Date().toISOString();

  // Get the input svd file
  const svdPath = core.getInput('path', { required: true });
  const githubToken = core.getInput('token', { required: true });
  const svdConv = new SVDConv(svdConvPath);
  const result = await svdConv.run(svdPath);

  if (result) {
    core.info(`SVDConv results: \
${result.stats.errors} errors, \
${result.stats.warnings} warnings, ${result.stats.notes} notes`);

    let sha = github.context.sha;

    if (github.context.payload.pull_request?.head?.sha) {
        sha = github.context.payload.pull_request.head.sha;
    }

    const options: CheckOptions = {
        token: githubToken,
        name: "svdconv",
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        head_sha: sha,
        started_at: startedAt,
    };

    await uploadResult(result, svdPath, options);
  }

  core.info(`svdConvPath: ${svdConvPath}`);
  core.info(`test ${result}`);
}

main()
