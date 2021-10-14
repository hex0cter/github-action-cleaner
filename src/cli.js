const { Octokit } = require("octokit");
const { ArgumentParser } = require("argparse");
const { version } = require("../package.json");
const prompt = require("prompt-sync")({ sigint: true });
const chalk = require("chalk");

const itemsPerPage = 100;

const getInput = (text) => {
  while (true) {
    const value = prompt(text);
    if (!!value) {
      return value;
    }
  }
};

const getIdsForAllWorkflowRuns = async ({ octokit, owner, repo, workflowId }) => {
  let response;

  response = await octokit.rest.actions.listWorkflowRuns({
    owner,
    repo,
    workflow_id: workflowId,
    per_page: 1,
  });
  const workflowRunTotalCount = response.data.total_count;
  console.log(`${workflowRunTotalCount} runs found for this workflow.`);

  let workflowRunIds = [];
  const totalPages = parseInt(workflowRunTotalCount / itemsPerPage) + 1;
  for(let pageIndex = 1; pageIndex <= totalPages; pageIndex++) {
    response = await octokit.rest.actions.listWorkflowRuns({
      owner,
      repo,
      workflow_id: workflowId,
      per_page: itemsPerPage,
      page: pageIndex,
    });

    const ids = response.data.workflow_runs.map((run) => ({
      id: run.id,
    }));

    workflowRunIds = workflowRunIds.concat(ids);
  }

  return workflowRunIds;
}

const start = async ({ github_token, owner, repo }) => {
  console.log(
    chalk.bold("This script needs your github token to perform actions.")
  );
  console.log(
    `For more info please visit ${chalk.blue.underline.bold(
      "https://github.com/settings/tokens/new?scopes=repo"
    )}\n`
  );

  github_token = github_token || getInput("Enter your github token: ");
  const octokit = new Octokit({ auth: github_token });

  // Compare: https://docs.github.com/en/rest/reference/users#get-the-authenticated-user
  const {
    data: { login },
  } = await octokit.rest.users.getAuthenticated();

  console.log(`Welcome, ${chalk.bold(login)}!\n`);

  owner = owner || getInput("Please enter the owner (organization) name: ");
  repo = repo || getInput("Please enter the repo name: ");

  let response;

  response = await octokit.rest.actions.listRepoWorkflows({
    owner,
    repo,
    per_page: itemsPerPage,
  });
  const workflowTotalCount = response.data.total_count;
  console.log(`${workflowTotalCount} workflow found for this repo.`);

  const workflows = response.data.workflows.map((workflow) => ({
    id: workflow.id,
    name: workflow.name,
  }));
  console.log(workflows);
  console.log();

  console.log("Which workflow do you want to clean?");
  const workflowId = getInput("Enter a workflow id: ");

  const workflowRunIds = await getIdsForAllWorkflowRuns({octokit, owner, repo, workflowId});

  workflowRunIds.forEach(async (workflowRun) => {
    console.log(`Removing ${workflowRun.id}...`);
    await octokit.rest.actions.deleteWorkflowRun({
      owner,
      repo,
      run_id: workflowRun.id,
    });
  });
};

(async () => {
  const parser = new ArgumentParser({
    description:
      "Example: github-action-cleaner -o hex0cter -r 2fa-otp -t ghp_zfkKFfxQoM6Y8jCYETdwEDdw0fmBtDEOyx1f3DBrm3",
  });

  parser.add_argument("-v", "--version", { action: "version", version });
  parser.add_argument("-o", "--owner", { help: "Owner of repo" });
  parser.add_argument("-r", "--repo", { help: "Repo name" });
  parser.add_argument("-t", "--github-token", {
    help: "Github token from https://github.com/settings/tokens/new?scopes=repo",
  });

  const args = parser.parse_args();
  await start(args);
})();
