/* ==========================================================
   Mentor details page script
   Path: public/admin/js/mentor-details.js
   ========================================================== */
(function () {
  'use strict';

  /* ---------- Tabs ---------- */
  var tabs = document.querySelectorAll('.md-tab');
  var panes = document.querySelectorAll('.md-pane');
  var names = ['overview', 'documents', 'activity'];

  function show(name) {
    tabs.forEach(function (t) { t.classList.toggle('active', t.dataset.tab === name); });
    panes.forEach(function (p) { p.classList.toggle('active', p.id === 'pane-' + name); });
    if (history.replaceState) history.replaceState(null, '', '#' + name);
  }
  tabs.forEach(function (t) { t.addEventListener('click', function () { show(t.dataset.tab); }); });
  var hash = location.hash.replace('#', '');
  if (names.indexOf(hash) > -1) show(hash);

  /* ---------- Manual review form ---------- */
  var form = document.getElementById('reviewForm');
  if (!form) return;

  var boxes = form.querySelectorAll('input[type="checkbox"]');
  var saveBtn = document.getElementById('rvSave');
  var bar = document.getElementById('rvBar');
  var count = document.getElementById('rvCount');
  var meta = document.getElementById('rvMeta');
  var approveBtn = document.getElementById('approveBtn');
  var readyBox = document.getElementById('readyBox');
  var readyText = document.getElementById('readyText');
  var docsOk = form.dataset.docsOk === '1';
  var dirty = false;

  function required() { return Array.prototype.filter.call(boxes, function (b) { return b.dataset.required === '1'; }); }

  function refresh() {
    var req = required();
    var done = req.filter(function (b) { return b.checked; }).length;
    var pct = req.length ? Math.round(done / req.length * 100) : 0;
    bar.style.width = pct + '%';
    bar.style.background = done === req.length ? 'var(--ok)' : 'var(--warn)';
    count.textContent = done + ' of ' + req.length + ' required checks done';
    boxes.forEach(function (b) { b.closest('.rv-item').classList.toggle('on', b.checked); });
    return done === req.length;
  }

  function setApprove(enabled, text) {
    if (approveBtn) approveBtn.disabled = !enabled;
    if (readyBox) {
      readyBox.className = 'md-ready ' + (enabled ? 'yes' : 'no');
      readyBox.querySelector('i').className = 'fas ' + (enabled ? 'fa-circle-check' : 'fa-lock');
      readyText.textContent = text;
    }
  }

  function toast(type, msg) {
    if (window.adminToast) return window.adminToast(type, msg);
    alert(msg);
  }

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = String(s == null ? '' : s);
    return d.innerHTML;
  }

  boxes.forEach(function (b) {
    b.addEventListener('change', function () {
      dirty = true;
      refresh();
      // any change invalidates approval until it is saved again
      setApprove(false, 'You changed the checklist. Save the review to unlock approval.');
    });
  });
  form.querySelector('textarea').addEventListener('input', function () { dirty = true; });

  window.addEventListener('beforeunload', function (e) {
    if (dirty) { e.preventDefault(); e.returnValue = ''; }
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var checks = {};
    boxes.forEach(function (b) { checks[b.name] = b.checked; });

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving';

    fetch(form.dataset.url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ checks: checks, notes: form.querySelector('textarea').value })
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (!res.ok || !res.d.success) throw new Error(res.d.message || 'Could not save.');
        dirty = false;
        meta.innerHTML = 'Last saved by <b>' + esc(res.d.reviewedBy || 'you') + '</b><br>' + esc(new Date(res.d.reviewedAt).toLocaleString('en-GB'));
        var unlocked = res.d.complete && docsOk;
        setApprove(unlocked, unlocked
          ? 'Manual checklist complete. You can approve this mentor.'
          : (!docsOk ? 'Required documents are missing. Approval is locked.'
                     : 'Approval is locked until all required checks are done and saved.'));
        toast(res.d.complete ? 'success' : 'info', res.d.message);
      })
      .catch(function (err) { toast('error', err.message || 'Could not save.'); })
      .finally(function () {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-floppy-disk"></i> Save review';
      });
  });

  refresh();
})();