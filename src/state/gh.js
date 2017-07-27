import {observable, action, runInAction} from 'mobx';
import Authenticator from 'netlify-auth-providers';
import LocalForage from "localforage";

const auth = new Authenticator({site_id: "gotell-admin.netlify.com"});
const repo = process.env.REACT_APP_REPO;
const endpoint = "https://api.github.com";
const lsKey = "gotell.credentials";

const lsData = JSON.parse(localStorage.getItem(lsKey) || '{}');

const gh = observable({
  token: lsData.token,
  error: null,
  loading: false,
  user: lsData.user,
  comments: null,
  awaiting_moderation: null,
  threads: null
});

const apiRequest = action('apiRequest', function apiRequest(path, options) {
  gh.loading = true;
  options = options || {};
  options.headers = options.headers || {};
  options.headers.Authorization = `token ${gh.token}`;
  const ignoreErrors = options.ignoreErrors;
  delete options.ignoreErrors;
  const promise = fetch(`${endpoint}${path}`, options)
    .then((response) => {
      if (!response.ok) {
        throw(new Error("Failed to load commits"));
      }

      return response.json();
    })
  if (!ignoreErrors) {
    promise.catch(action("error", (error) => {
      gh.loading = false;
      gh.error = true;
    }));
  }
  return promise;
});

gh.authenticate = action(function authenticate() {
  if (gh.loading) { return; }
  gh.loading = true;
  auth.authenticate({provider: 'github', scope: 'repo'}, action('token-cb', (err, data) => {
    gh.token = data.token;
    apiRequest('/user').then((user) => {
      runInAction(() => {
        localStorage.setItem(lsKey, JSON.stringify({token: data.token, user}));
        gh.user = user;
        gh.error = err;
        gh.loading = false;
      });
    });
  }));
});

gh.loadAwaiting = action(function loadAwaiting() {
  apiRequest(`/repos/${repo}/pulls`)
    .then(action("process-gh-requests", (awaiting) => {
      gh.awaiting_moderation = awaiting;
      gh.loading = false;
    }));
});

gh.loadComments = action(function loadComments() {
  apiRequest(`/repos/${repo}/commits`)
    .then((commits) => (
      Promise.all(commits.map((commit) => fetchCommit(commit.sha)))
    ))
    .then((commits) => (
      Promise.all(commits.filter((commit) => {
        if (commit.files && commit.files[0].changes === 1 && commit.files[0].additions === 1) { return true; }
        commit.files && commit.files.map((f) => {
          if (f.status == "removed") {
            return LocalForage.removeItem(`gh.${f.sha}`);
          }
        })
      }))
    ))
    .then((commits) => (
      Promise.all(commits.map((commit) => (
        Promise.all(commit.files.map((file) => (
          fetchFile(file.filename, file.sha).then((data) => file.data = data)
        ))).then(() => commit)
      )))
    ))
    .then(action("process-gh-requests", (commits) => {
      gh.comments = commits.filter((c) => c.files && c.files[0].data);
      gh.loading = false;
    }));
});

gh.toggleComment = action(function toggleComment(id) {
  for (let i=0; i<gh.comments.length; i++) {
    if (gh.comments[i].sha === id) {
      gh.comments[i].checked = !gh.comments[i].checked;
    }
  }
});

gh.toggleAwaiting = action(function toggleAwaiting(id) {
  for (let i=0; i<gh.awaiting_moderation.length; i++) {
    if (gh.awaiting_moderation[i].id === id) {
      gh.awaiting_moderation[i].checked = !gh.awaiting_moderation[i].checked;
    }
  }
});


gh.deleteCheckedComments = action(function deleteCheckedComments() {
  gh.comments.filter((c) => c.checked).forEach((comment) => {
    apiRequest(`/repos/${repo}/commits/${comment.sha}`)
      .then((commit) => {
        Promise.all(commit.files.map((file) => {
          if (file.status === 'added') {
            return apiRequest(`/repos/${repo}/contents/${file.filename}`, {
              method: 'DELETE',
              body: JSON.stringify({
                message: "Deleted comment\n\n${comment.commit.message}",
                sha: file.sha
              })
            })
          }
        })).then(action('deleted', () => {
          gh.comments = gh.comments.filter((c) => c.sha !== comment.sha);
          gh.loading = false;
        }));
      });
  });
});

function deleteBranch(branch) {
  return apiRequest(`/repos/${repo}/git/refs/heads/${branch}`, {method: 'DELETE'});
}

gh.updatePR = action(function updatePR(pr, state) {
  return apiRequest(`/repos/${repo}/pulls/${pr.number}`, {
    method: 'PATCH',
    body: JSON.stringify({state: state})
  }).then((pr) => {
    pr.state = 'closed';
    return pr;
  });
});

gh.removePR = action(function removePR(pr) {
  gh.awaiting_moderation = gh.awaiting_moderation.filter((p) => p.id !== pr.id);
})

gh.deleteCheckedPRs = action(function deleteCheckedPRs() {
  gh.awaiting_moderation.filter((c) => c.checked).forEach((pr) => {
    gh.updatePR(pr, 'closed')
      .then(gh.removePR)
      .then(() => deleteBranch(pr.head.ref));
  });
});

gh.approveCheckedPRs = action(function approveCheckedPRs() {
  gh.awaiting_moderation.filter((c) => c.checked).forEach((pr) => {
    apiRequest(`/repos/${repo}/pulls/${pr.number}/merge`, {
      method: 'PUT',
      body: JSON.stringify({commit_title: 'Approved Comment: '})
    }).then(() => gh.removePR(pr)).then(() => deleteBranch(pr.head.ref));
  });
});

function fetchCommit(sha) {
  const cache = sha ? LocalForage.getItem(`gh.${ sha }`) : Promise.resolve(null);
  return cache.then((cached) => {
    if (cached) { return cached; }

    return apiRequest(`/repos/${repo}/commits/${sha}`).then((commit) => {
      LocalForage.setItem(`gh.${ sha }`, commit);
      return commit;
    });
  });
}

function fetchFile(path, sha) {
  const cache = sha ? LocalForage.getItem(`gh.${ sha }`) : Promise.resolve(null);
  return cache.then((cached) => {
    if (cached) { return cached; }

    return apiRequest(`/repos/${repo}/contents/${path}`, {ignoreErrors: true}).then((file) => {
      LocalForage.setItem(`gh.${ file.sha }`, file);
      return file;
    }).catch((err) => null);
  });
}

function fetchThread(path, obj) {
  if (obj.threads) {
    return Promise.resolve(obj.threads);
  }
  return apiRequest(`/repos/${repo}/contents/threads/${path}`)
    .then(action('thread-cb', (threads) => {
      obj.threads = threads;
      return obj;
    }));
}
async function loadThread(path) {
  await fetchThread('', gh);
  let obj = gh;
  const segments = path.split('/').filter((s) => s);
  for (let i=0; i<segments.length; i++) {
    obj = obj.threads.filter((t) => t.name === segments[i])[0];
    const segmentPath = segments.slice(0,i+1).join('/');
    await fetchThread(segmentPath, obj);
  }
  return obj;
}

gh.loadThread = action(function (path) {
  loadThread(path).then(action('thread-loaded', (obj) => {
    gh.loading = false;
  }));
});

gh.logout = action(function logout() {
  localStorage.removeItem(lsKey);
  gh.token = null;
  gh.user = null;
});

export default gh;
