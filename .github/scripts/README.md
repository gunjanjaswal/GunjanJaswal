# Custom GitHub Statistics Action

This custom GitHub Action provides more accurate and comprehensive statistics for your GitHub profile README.md.

## Features

- **Complete Repository Count**: Counts all your repositories, including public, private, forks, and archived repos
- **Accurate Commit Statistics**: Tracks commits across all repositories, including yearly and monthly breakdowns
- **Language Distribution**: Shows the programming languages you use most frequently
- **Most Active Repositories**: Highlights your most actively maintained repositories
- **Monthly Activity Chart**: Displays your commit activity over the last 12 months

## How It Works

1. The action runs daily at midnight UTC (or can be triggered manually)
2. It uses the GitHub API to collect comprehensive statistics about your repositories and commits
3. The script generates formatted markdown with your updated statistics
4. It automatically updates the GitHub Statistics section in your README.md file

## Setup Requirements

### 1. GitHub Token

The action uses the default `GITHUB_TOKEN` provided by GitHub Actions, which has read access to your public repositories. 

For more comprehensive statistics (including private repositories), you may need to create a Personal Access Token (PAT) with appropriate permissions:

1. Go to GitHub Settings → Developer Settings → Personal Access Tokens
2. Create a new token with the following permissions:
   - `repo` (Full control of private repositories)
   - `read:user` (Read access to user profile data)
3. Add this token as a repository secret named `GH_PAT`
4. Update the workflow file to use this token instead of `GITHUB_TOKEN`

### 2. README.md Structure

The script looks for the section between `## 📊 GitHub Statistics` and `## 🔌 WordPress Plugins` in your README.md file. Make sure these section headers exist in your README.md.

## Manual Trigger

You can manually trigger the action to update your statistics:

1. Go to your repository on GitHub
2. Click on "Actions"
3. Select "Update GitHub Statistics" workflow
4. Click "Run workflow"

## Customization

You can customize the statistics by editing the `generate_github_stats.py` script:

- Change the number of languages displayed
- Modify the number of repositories in the "Most Active" section
- Adjust the formatting and layout of the statistics
- Add additional metrics that are important to you

## Troubleshooting

If you encounter any issues:

1. Check the Action logs for error messages
2. Verify that your README.md has the correct section markers
3. Ensure your GitHub token has the necessary permissions
4. For API rate limit issues, consider implementing caching or reducing the frequency of updates
