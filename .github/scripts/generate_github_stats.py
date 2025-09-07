#!/usr/bin/env python3
"""
GitHub Statistics Generator
This script generates accurate GitHub statistics and updates the README.md file.
"""

import os
import re
import json
import base64
import requests
from datetime import datetime
from dateutil.relativedelta import relativedelta
from github import Github

# Initialize GitHub API client
github_token = os.environ.get("GITHUB_TOKEN")
g = Github(github_token)
username = "gunjanjaswal"  # Your GitHub username

def get_all_repositories():
    """Get all repositories (public, private, forks, etc.)"""
    user = g.get_user(username)
    
    # Get all repositories including private ones if token has access
    all_repos = list(user.get_repos())
    
    # Count repositories by type
    stats = {
        "total": len(all_repos),
        "public": len([r for r in all_repos if not r.private]),
        "private": len([r for r in all_repos if r.private]),
        "forks": len([r for r in all_repos if r.fork]),
        "sources": len([r for r in all_repos if not r.fork]),
        "archived": len([r for r in all_repos if r.archived]),
        "active": len([r for r in all_repos if not r.archived])
    }
    
    # Get languages used across all repositories
    languages = {}
    for repo in all_repos:
        if repo.language:
            if repo.language in languages:
                languages[repo.language] += 1
            else:
                languages[repo.language] = 1
    
    # Sort languages by usage count
    sorted_languages = dict(sorted(languages.items(), key=lambda x: x[1], reverse=True))
    
    return {
        "repositories": all_repos,
        "stats": stats,
        "languages": sorted_languages
    }

def get_commit_statistics():
    """Get commit statistics across all repositories"""
    user = g.get_user(username)
    all_repos = list(user.get_repos())
    
    # Initialize statistics
    current_year = datetime.now().year
    last_year = current_year - 1
    
    commit_stats = {
        "total": 0,
        str(current_year): 0,
        str(last_year): 0,
        "by_month": {},
        "by_repo": {}
    }
    
    # Initialize months (last 12 months)
    for i in range(12):
        date = datetime.now() - relativedelta(months=i)
        month_key = date.strftime("%Y-%m")
        commit_stats["by_month"][month_key] = 0
    
    # Count commits
    for repo in all_repos:
        if repo.fork:
            continue  # Skip forks to avoid double counting
            
        repo_name = repo.name
        commit_stats["by_repo"][repo_name] = 0
        
        try:
            commits = repo.get_commits(author=username)
            for commit in commits:
                commit_date = commit.commit.author.date
                commit_year = commit_date.year
                commit_month_key = commit_date.strftime("%Y-%m")
                
                # Increment total
                commit_stats["total"] += 1
                
                # Increment by year
                if commit_year == current_year:
                    commit_stats[str(current_year)] += 1
                elif commit_year == last_year:
                    commit_stats[str(last_year)] += 1
                
                # Increment by month if in the last 12 months
                if commit_month_key in commit_stats["by_month"]:
                    commit_stats["by_month"][commit_month_key] += 1
                
                # Increment by repo
                commit_stats["by_repo"][repo_name] += 1
        except Exception as e:
            print(f"Error getting commits for {repo_name}: {e}")
    
    # Sort repositories by commit count
    commit_stats["by_repo"] = dict(sorted(commit_stats["by_repo"].items(), 
                                         key=lambda x: x[1], 
                                         reverse=True))
    
    return commit_stats

def generate_stats_markdown():
    """Generate markdown for GitHub statistics"""
    repo_data = get_all_repositories()
    commit_data = get_commit_statistics()
    
    # Format the current date
    current_date = datetime.now().strftime("%B %d, %Y")
    
    markdown = f"""
## 📊 GitHub Statistics (Updated: {current_date})

<div align="center">

### 📈 Repository Overview
| Total Repositories | Public | Private | Forks | Active | Archived |
|-------------------|--------|---------|-------|--------|----------|
| {repo_data["stats"]["total"]} | {repo_data["stats"]["public"]} | {repo_data["stats"]["private"]} | {repo_data["stats"]["forks"]} | {repo_data["stats"]["active"]} | {repo_data["stats"]["archived"]} |

### 💻 Language Distribution
| Language | Repositories |
|----------|--------------|
"""
    
    # Add top 8 languages
    for i, (lang, count) in enumerate(list(repo_data["languages"].items())[:8]):
        markdown += f"| {lang} | {count} |\n"
    
    markdown += f"""
### 📝 Commit Activity
| Total Commits | Commits in {datetime.now().year} | Commits in {datetime.now().year-1} |
|---------------|--------------------------|--------------------------|
| {commit_data["total"]} | {commit_data[str(datetime.now().year)]} | {commit_data[str(datetime.now().year-1)]} |

### 🔥 Most Active Repositories
| Repository | Commits |
|------------|---------|
"""
    
    # Add top 5 repositories by commit count
    for i, (repo, count) in enumerate(list(commit_data["by_repo"].items())[:5]):
        markdown += f"| [{repo}](https://github.com/{username}/{repo}) | {count} |\n"
    
    # Add monthly commit chart data
    months = list(commit_data["by_month"].keys())
    counts = list(commit_data["by_month"].values())
    
    # Reverse to show oldest to newest
    months.reverse()
    counts.reverse()
    
    # Format month labels for display (e.g., "2025-09" to "Sep")
    month_labels = [m.split("-")[1] for m in months]
    month_names = []
    for m in month_labels:
        month_name = datetime(2000, int(m), 1).strftime("%b")
        month_names.append(month_name)
    
    markdown += f"""
### 📅 Monthly Commit Activity (Last 12 Months)
```
{' '.join(month_names)}
{' '.join([str(c).ljust(3) for c in counts])}
```

</div>
"""
    
    return markdown

def update_readme():
    """Update the README.md file with the generated statistics"""
    # Get the current README content
    user = g.get_user(username)
    repo = user.get_repo(username)
    
    try:
        contents = repo.get_contents("README.md")
        readme_content = base64.b64decode(contents.content).decode('utf-8')
        
        # Generate new statistics markdown
        stats_markdown = generate_stats_markdown()
        
        # Define markers for the statistics section
        start_marker = "## 📊 GitHub Statistics"
        end_marker = "## 🔌 WordPress Plugins"
        
        # Find the statistics section
        start_index = readme_content.find(start_marker)
        end_index = readme_content.find(end_marker)
        
        if start_index != -1 and end_index != -1:
            # Replace the statistics section
            new_readme = (
                readme_content[:start_index] + 
                stats_markdown + 
                "\n" + 
                readme_content[end_index:]
            )
            
            # Update the README
            repo.update_file(
                path="README.md",
                message="Update GitHub Statistics",
                content=new_readme,
                sha=contents.sha
            )
            print("README.md updated successfully with new statistics.")
        else:
            print("Could not find the statistics section in README.md")
    except Exception as e:
        print(f"Error updating README.md: {e}")
        
        # If we can't update directly through the API, write to a local file
        # that will be committed by the GitHub Action
        with open("README.md", "r", encoding="utf-8") as f:
            readme_content = f.read()
        
        # Generate new statistics markdown
        stats_markdown = generate_stats_markdown()
        
        # Define markers for the statistics section
        start_marker = "## 📊 GitHub Statistics"
        end_marker = "## 🔌 WordPress Plugins"
        
        # Find the statistics section
        start_index = readme_content.find(start_marker)
        end_index = readme_content.find(end_marker)
        
        if start_index != -1 and end_index != -1:
            # Replace the statistics section
            new_readme = (
                readme_content[:start_index] + 
                stats_markdown + 
                "\n" + 
                readme_content[end_index:]
            )
            
            # Write the updated content to the README file
            with open("README.md", "w", encoding="utf-8") as f:
                f.write(new_readme)
            print("Local README.md updated successfully with new statistics.")
        else:
            print("Could not find the statistics section in local README.md")

if __name__ == "__main__":
    update_readme()
