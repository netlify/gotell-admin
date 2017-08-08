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
  commentsPages: {},
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
  let url = path.match(/^https:/) ? path : `${endpoint}${path}`;
  if (!url.match(/\?/)) {
    url = `${url}?ts=${new Date().getTime()}`;
  }

  const promise = fetch(url, options)
    .then((response) => {
      if (!response.ok) {
        throw(new Error("Failed to load commits"));
      }

      return response.json().then((data) => ({data, headers: response.headers}));
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
    apiRequest('/user').then((response) => {
      runInAction(() => {
        localStorage.setItem(lsKey, JSON.stringify({token: data.token, user: response.data}));
        gh.user = response.data;
        gh.error = err;
        gh.loading = false;
      });
    });
  }));
});

gh.loadAwaiting = action(function loadAwaiting() {
  apiRequest(`/repos/${repo}/pulls`)
    .then(action("process-gh-requests", ({data}) => {
      gh.awaiting_moderation = data;
      gh.loading = false;
    }));
});

gh.loadComments = action(function loadComments(pageLink) {
  apiRequest(pageLink || `/repos/${repo}/commits`)
    .then(action("process-commit-list", ({headers, data}) => {
      const link = headers.get("Link");
      if (link) {
        const pagination = {};
        link.split(',').forEach((part) => {
          const [url, rel] = part.split(';').map((el) => el.trim());
          pagination[rel.match(/rel="(.+)"/)[1]] = url.match(/^<(.+)>$/)[1];
        });
        gh.commentsPages = pagination;
      } else {
        gh.commentsPages = {};
      }
      return Promise.all(data.map((commit) => fetchCommit(commit.sha)));
    }))
    .then((commits) => (
      Promise.all(commits.filter((commit) => {
        if (commit.files && commit.files[0] && commit.files[0].changes === 1 && commit.files[0].additions === 1) { return true; }
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
      const comments = commits.filter((c) => c.files && c.files[0].data);
      if (pageLink) {
        gh.comments = (gh.comments.concat(comments))
      } else {
        gh.comments = comments;
      }
      if (gh.comments.length < 5 && gh.commentsPages.next)  {
        gh.loadComments(gh.commentsPages.next);
      } else {
        gh.loading = false;
      }
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
      .then(({data}) => {
        Promise.all(data.files.map((file) => {
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
      })
    .then(gh.loadComments)
    .catch(gh.loadComments);
  });
});

function deleteBranch(branch) {
  return apiRequest(`/repos/${repo}/git/refs/heads/${branch}`, {method: 'DELETE'});
}

gh.updatePR = action(function updatePR(pr, state) {
  return apiRequest(`/repos/${repo}/pulls/${pr.number}`, {
    method: 'PATCH',
    body: JSON.stringify({state: state})
  }).then(({data}) => {
    data.state = 'closed';
    return data;
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

    return apiRequest(`/repos/${repo}/commits/${sha}`).then(({data}) => {
      LocalForage.setItem(`gh.${ sha }`, data);
      return data;
    });
  });
}

function fetchFile(path, sha) {
  const cache = sha ? LocalForage.getItem(`gh.${ sha }`) : Promise.resolve(null);
  return cache.then((cached) => {
    if (cached) { return cached; }

    return apiRequest(`/repos/${repo}/contents/${path}`, {ignoreErrors: true}).then(({data}) => {
      LocalForage.setItem(`gh.${ data.sha }`, data);
      return data;
    }).catch((err) => null);
  });
}

gh.commitComment = action(function commitComment(attributes) {
  const {comment, thread} = attributes;

  return apiRequest(`/repos/${repo}/contents/${thread.path}`, {
    method: 'PUT',
    body: JSON.stringify({
      message: `Updated comment ${thread}`,
      content: btoa(JSON.stringify(comment)),
      sha: thread.sha,
    })
  }).then(action('commitComment-cb', () => gh.loading = false));
})


function fetchThread(path, obj) {
  if (obj.threads) {
    return Promise.resolve(obj.threads);
  }
  return apiRequest(`/repos/${repo}/contents/threads/${path}`)
    .then(({data}) => (
      Promise.all(data.map((el) => {
        if (el.type === 'file') {
          return fetchFile(el.path, el.sha).then((f) => {
            el.comment = JSON.parse(atob(f.content));
            return el;
          });
        }
        return el;
      }
    ))))
    .then(action('thread-cb', (elements) => {
      obj.threads = elements;
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
