/* ==========================================================
   MNCConnect Admin - client script
   Path: public/admin/js/admin.js
   ========================================================== */
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }

  /* ---------- 1. Apply data-* values (keeps EJS free of inline style="<%= %>") ---------- */
  function applyData() {
    document.querySelectorAll('[data-w]').forEach(function (el) {
      el.style.width = el.dataset.w + '%';
      if (el.dataset.ok !== undefined) el.style.background = el.dataset.ok === '1' ? 'var(--ok)' : 'var(--warn)';
    });
    document.querySelectorAll('[data-h]').forEach(function (el) { el.style.height = el.dataset.h + '%'; });
    document.querySelectorAll('[data-bg]').forEach(function (el) { el.style.background = el.dataset.bg; });
  }
  // Small delay so the CSS transition animates from 0
  window.addEventListener('load', function () { requestAnimationFrame(applyData); });

  /* ---------- 2. Toast ---------- */
  function toast(type, msg) {
    var wrap = $('toasts');
    if (!wrap) return;
    var map = { success: 'ok', ok: 'ok', error: 'bad', bad: 'bad', info: '' };
    var icon = { ok: 'fa-circle-check', bad: 'fa-circle-xmark', '': 'fa-circle-info' };
    var cls = map[type] !== undefined ? map[type] : '';
    var el = document.createElement('div');
    el.className = 'toast ' + cls;
    var i = document.createElement('i');
    i.className = 'fas ' + icon[cls];
    var s = document.createElement('span');
    s.textContent = msg; // textContent = no XSS
    el.appendChild(i); el.appendChild(s);
    wrap.appendChild(el);
    setTimeout(function () { el.remove(); }, 4200);
  }
  window.adminToast = toast;

  /* ---------- 3. Sidebar (mobile) ---------- */
  var sidebar = $('sidebar'), overlay = $('overlay'), menuBtn = $('menuBtn');
  function closeSide() { if (sidebar) sidebar.classList.remove('open'); if (overlay) overlay.classList.remove('show'); }
  if (menuBtn) menuBtn.addEventListener('click', function () { sidebar.classList.add('open'); overlay.classList.add('show'); });
  if (overlay) overlay.addEventListener('click', closeSide);

  /* ---------- 4. Confirm modal ---------- */
  var modal = $('modal'), mTitle = $('modalTitle'), mMsg = $('modalMsg'),
      mReasonWrap = $('modalReasonWrap'), mReason = $('modalReason'),
      mCancel = $('modalCancel'), mOk = $('modalOk');
  var pending = null;

  function openModal(opts) {
    pending = opts;
    mTitle.textContent = opts.title;
    mMsg.textContent = opts.message;
    mReasonWrap.style.display = opts.reason ? 'block' : 'none';
    mReason.value = '';
    mOk.className = 'btn ' + (opts.danger ? 'btn-bad' : 'btn-ok');
    mOk.textContent = opts.okText || 'Confirm';
    mOk.disabled = false;
    modal.classList.add('show');
    (opts.reason ? mReason : mOk).focus();
  }
  function closeModal() { if (modal) modal.classList.remove('show'); pending = null; }

  if (modal) {
    mCancel.addEventListener('click', closeModal);
    modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeModal(); closeSide(); } });

    mOk.addEventListener('click', function () {
      if (!pending) return;
      var reason = mReason.value.trim();
      if (pending.reason && reason.length < 5) {
        toast('error', 'Please write a reason (at least 5 characters).');
        mReason.focus();
        return;
      }
      mOk.disabled = true;
      mOk.textContent = 'Please wait...';
      pending.run(reason).then(closeModal).catch(function () { mOk.disabled = false; mOk.textContent = pending ? pending.okText : 'Confirm'; });
    });
  }

  /* ---------- 5. Mentor actions (approve / reject / pending) ---------- */
  function call(method, url, body) {
    return fetch(url, {
      method: method,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (r.status === 401) { location.href = '/admin/login'; throw new Error('Session expired'); }
        if (!r.ok || d.success === false) throw new Error(d.message || 'Something went wrong.');
        return d;
      });
    });
  }

  var actions = {
    approve: { title: 'Approve mentor?', verb: 'approved', ok: 'Approve', danger: false, reason: false },
    reject: { title: 'Reject mentor?', verb: 'rejected', ok: 'Reject', danger: true, reason: true },
    pending: { title: 'Move back to pending?', verb: 'moved to pending', ok: 'Move to pending', danger: false, reason: false }
  };

  document.addEventListener('click', function (e) {
    var copyBtn = e.target.closest('[data-copy]');
    if (copyBtn) {
      if (navigator.clipboard) navigator.clipboard.writeText(copyBtn.dataset.copy).then(function () { toast('success', 'Copied'); });
      return;
    }

    var btn = e.target.closest('[data-action]');
    if (!btn || btn.disabled) return;
    var a = actions[btn.dataset.action];
    if (!a) return;

    var id = btn.dataset.id, name = btn.dataset.name || 'this mentor';
    openModal({
      title: a.title,
      message: name + ' will be ' + a.verb + '.',
      okText: a.ok,
      danger: a.danger,
      reason: a.reason,
      run: function (reason) {
        return call('PATCH', '/admin/mentors/' + encodeURIComponent(id) + '/' + btn.dataset.action, a.reason ? { reason: reason } : {})
          .then(function (d) {
            toast('success', d.message || 'Done');
            setTimeout(function () { location.reload(); }, 700);
          })
          .catch(function (err) { toast('error', err.message); throw err; });
      }
    });
  });

  /* ---------- 6. Misc ---------- */
  document.querySelectorAll('[data-autosubmit]').forEach(function (el) {
    el.addEventListener('change', function () { if (el.form) el.form.submit(); });
  });

  // Press "/" to focus search
  document.addEventListener('keydown', function (e) {
    var t = e.target.tagName;
    if (e.key === '/' && t !== 'INPUT' && t !== 'TEXTAREA' && t !== 'SELECT') {
      var s = document.querySelector('.search-box .input');
      if (s) { e.preventDefault(); s.focus(); }
    }
  });
})();