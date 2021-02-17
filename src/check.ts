export interface CheckRunAnnotation {
  /**
   * The path of the file to add an annotation to. For example, `assets/css/main.css`
   */
  path: string,
  /**
   * The start line of the annotation.
   */
  start_line: number,
  /**
   * The end line of the annotation.
   */
  end_line: number,
  /**
   * The start column of the annotation.
   * Annotations only support start_column and end_column on the same line.
   * Omit this parameter if start_line and end_line have different values.
   */
  start_column?: number,
  /**
   * The end column of the annotation.
   * Annotations only support start_column and end_column on the same line.
   * Omit this parameter if start_line and end_line have different values.
   */
  end_column?: number,
  /**
   * The level of the annotation. Can be one of `notice`, `warning`, or `failure`.
   */
  annotation_level: string,
  /**
   * A short description of the feedback for these lines of code. The maximum size is 64 KB.
   */
  message: string,
  /**
   * The title that represents the annotation. The maximum size is 255 characters.
   */
  title?: string,
  /**
   * Details about this annotation. The maximum size is 64 KB.
   */
  raw_details?: string
}

export interface CheckRunOutput {
  /**
   * The title of the check run.
   */
  title: string,
  /**
   * The summary of the check run. This parameter supports Markdown.
   */
  summary: string,
  /**
   * The details of the check run. This parameter supports Markdown.
   */
  text?: string,
  /**
   * Adds information from your analysis to specific lines of code.
   * Annotations are visible on GitHub in the *Checks* and *Files changed* tab of the pull request.
   * The Checks API limits the number of annotations to a maximum of 50 per API request.
   * To create more than 50 annotations, you have to make multiple requests to the Update a check run endpoint.
   * Each time you update the check run, annotations are appended to the list of annotations that already exist for the check run.
   * For details about how you can view annotations on GitHub, see "About status checks".
   * See the annotations object description for details about how to use this parameter.
   */
  annotations?: Array<CheckRunAnnotation>,
  /**
   * Adds images to the output displayed in the GitHub pull request UI.
   * See the images object description for details.
   */
  images?: any
}

export interface CreateCheckRun {
  /**
   * Setting to application/vnd.github.v3+json is recommended.
   */
  accept?: string,
  owner?: string,
  repo?: string,
  /**
   * The name of the check. For example, "code-coverage".
   */
  name: string,

  /**
   * The SHA of the commit.
   */
  head_sha: string,
  /**
   * The URL of the integrator's site that has the full details of the check.
   * If the integrator does not provide this, then the homepage of the GitHub app is used.
   */
  details_url?: string,
  /**
   * A reference for the run on the integrator's system.
   */
  external_id?: string,
  /**
   * The current status. Can be one of queued, in_progress, or completed.
   * Default: queued
   */
  status?: string,
  /**
   * The time that the check run began.
   * This is a timestamp in ISO 8601 format: YYYY-MM-DDTHH:MM:SSZ.
   */
  started_at?: string,
  /**
   * *Required if you provide completed_at or a status of completed.*
   * The final conclusion of the check.
   * Can be one of `action_required`, `cancelled`, `failure`, `neutral`, `success`, `skipped`, `stale`, or `timed_out`.
   * When the conclusion is `action_required`, additional details should be provided on the site specified by `details_url`.
   * *Note:* Providing `conclusion` will automatically set the `status` parameter to `completed`.
   * You cannot change a check run conclusion to stale, only GitHub can set this.
   */
  conclusion?: string,
  /**
   * The time the check completed.
   * This is a timestamp in ISO 8601 format: YYYY-MM-DDTHH:MM:SSZ.
   */
  completed_at?: string,
  /**
   * Check runs can accept a variety of data in the output `object`, including a
   * `title` and `summary` and can optionally provide descriptive details about
   * the run.
   */
  output?: CheckRunOutput
}

export class Check {
  /**
   * A reference to the Octokit client
   */
  private client: any;

  /**
   * The unique id of the check-run
   */
  public id: number;

  /**
   * The current status. Can be one of queued, in_progress, or completed.
   * Default: queued
   */
  public status?: string;

  /**
   * The SHA of the commit.
   */
  public head_sha: string;

  public owner?: string;
  public repo?: string;
  /**
   * The name of the check. For example, "code-coverage".
   */
  public name: string;

  constructor(client: any) {
    this.client = client;
  }

  /**
   * Creates a new `Check` instance with a reference `client` and returns it on
   * success, null otherwise.
   */
  static async create(client: any, opts: CreateCheckRun): Promise<Check | null> {
    let check = new Check(client);

    check.name = opts.name;
    check.repo = opts.repo;
    check.owner = opts.owner;
    check.status = "in_progress";
    check.head_sha = opts.head_sha;

    try {
      const response = await client.checks.create(opts);

      check.id = response.data.id;
    } catch (error) {
      return null;
    }

    return check;
  }

  /**
   * Updates the check-run with a new output.
   */
  public async update(opts: { summary: string, text: string, annotations?: any[], images?: any[] }): Promise<void> {
    await this.client.checks.update({
        owner: this.owner,
        repo: this.repo,
        name: this.name,
        check_run_id: this.id,
        status: 'in_progress',
        output: {
          title: this.name,
          summary: opts.summary,
          text: opts.text,
          annotations: opts.annotations,
          images: opts.images
        }
    });
  }

  /**
   * Marks the check-run as complete.
   */
  public async complete(summary: string, text: string, conclusion: string = 'neutral'): Promise<void> {
    await this.client.checks.update({
        name: this.name,
        check_run_id: this.id,
        status: 'completed',
        conclusion,
        completed_at: new Date().toISOString(),
        output: {
            title: this.name,
            summary,
            text,
        }
    });
  }

  /**
   * Cancels the check-run by setting the `status` to `completed` and the
   * `conclusion` to `cancelled`.
   */
  public async cancel(summary: string, text: string): Promise<void> {
    await this.client.checks.update({
        check_run_id: this.id,
        status: 'completed',
        conclusion: 'cancelled',
        completed_at: new Date().toISOString(),
        output: {
            title: this.name,
            summary,
            text,
        }
    });
  }

}
