
/* ==========================================================
   Mentor Details Page Script
   Path: public/admin/js/mentor-details.js

   Features:
   - Tabs
   - Manual verification checklist
   - Save review
   - Approve mentor
   - Reject mentor
   - Move mentor back to pending
   - API debugging logs
   ========================================================== */

(function () {
  'use strict';

  console.log('🔥 MENTOR DETAILS JS LOADED');

  /* ==========================================================
     1. COMMON HELPERS
  ========================================================== */

  function toast(type, msg) {
    if (window.adminToast) {
      window.adminToast(type, msg);
    } else {
      alert(msg);
    }
  }

  function parseResponse(response) {
    return response.text().then(function (text) {
      var data;

      try {
        data = text ? JSON.parse(text) : {};
      } catch (err) {
        console.error('❌ Invalid JSON response:', text);
        throw new Error('Server returned an invalid response.');
      }

      console.log('📥 API RESPONSE STATUS:', response.status);
      console.log('📥 API RESPONSE BODY:', data);

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || 'Request failed. Please try again.'
        );
      }

      return data;
    });
  }

  function esc(value) {
    var div = document.createElement('div');
    div.textContent = String(value == null ? '' : value);
    return div.innerHTML;
  }

  /* ==========================================================
     2. TABS
  ========================================================== */

  var tabs = document.querySelectorAll('.md-tab');
  var panes = document.querySelectorAll('.md-pane');

  var names = ['overview', 'documents', 'activity'];

  function show(name) {
    tabs.forEach(function (tab) {
      tab.classList.toggle('active', tab.dataset.tab === name);
    });

    panes.forEach(function (pane) {
      pane.classList.toggle(
        'active',
        pane.id === 'pane-' + name
      );
    });

    if (history.replaceState) {
      history.replaceState(null, '', '#' + name);
    }
  }

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      show(tab.dataset.tab);
    });
  });

  var hash = location.hash.replace('#', '');

  if (names.indexOf(hash) !== -1) {
    show(hash);
  }

  /* ==========================================================
     3. MANUAL REVIEW FORM
  ========================================================== */

  var form = document.getElementById('reviewForm');

  if (form) {
    var boxes = form.querySelectorAll(
      'input[type="checkbox"]'
    );

    var saveBtn = document.getElementById('rvSave');
    var bar = document.getElementById('rvBar');
    var count = document.getElementById('rvCount');
    var meta = document.getElementById('rvMeta');

    var approveBtn = document.getElementById('approveBtn');
    var readyBox = document.getElementById('readyBox');
    var readyText = document.getElementById('readyText');

    var textarea = form.querySelector('textarea');

    var docsOk = form.dataset.docsOk === '1';
    var dirty = false;

    console.log('📋 REVIEW FORM FOUND:', !!form);
    console.log('📄 REQUIRED DOCUMENTS OK:', docsOk);
    console.log('🔘 APPROVE BUTTON FOUND:', !!approveBtn);

    function required() {
      return Array.prototype.filter.call(
        boxes,
        function (box) {
          return box.dataset.required === '1';
        }
      );
    }

    function refresh() {
      var req = required();

      var done = req.filter(function (box) {
        return box.checked;
      }).length;

      var pct = req.length
        ? Math.round((done / req.length) * 100)
        : 0;

      if (bar) {
        bar.style.width = pct + '%';
        bar.style.background =
          done === req.length ? 'var(--ok)' : 'var(--warn)';
      }

      if (count) {
        count.textContent =
          done + ' of ' + req.length + ' required checks done';
      }

      boxes.forEach(function (box) {
        var item = box.closest('.rv-item');

        if (item) {
          item.classList.toggle('on', box.checked);
        }
      });

      return done === req.length;
    }

    function setApprove(enabled, message) {
      if (approveBtn) {
        approveBtn.disabled = !enabled;
      }

      if (readyBox) {
        readyBox.className =
          'md-ready ' + (enabled ? 'yes' : 'no');

        var icon = readyBox.querySelector('i');

        if (icon) {
          icon.className =
            'fas ' +
            (enabled ? 'fa-circle-check' : 'fa-lock');
        }
      }

      if (readyText) {
        readyText.textContent = message;
      }

      console.log('🔐 APPROVAL UNLOCKED:', enabled);
      console.log('🔐 APPROVAL MESSAGE:', message);
    }

    /* Checklist changes */

    boxes.forEach(function (box) {
      box.addEventListener('change', function () {
        dirty = true;

        refresh();

        setApprove(
          false,
          'You changed the checklist. Save the review to unlock approval.'
        );
      });
    });

    if (textarea) {
      textarea.addEventListener('input', function () {
        dirty = true;
      });
    }

    /* Prevent accidental navigation */

    window.addEventListener('beforeunload', function (e) {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    });

    /* Save manual review */

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      console.log('📝 REVIEW SAVE CLICKED');

      var checks = {};

      boxes.forEach(function (box) {
        checks[box.name] = box.checked;
      });

      var url = form.dataset.url;

      console.log('📡 REVIEW API URL:', url);
      console.log('📋 REVIEW CHECKS:', checks);

      if (!url) {
        toast('error', 'Review API URL is missing.');
        return;
      }

      saveBtn.disabled = true;

      saveBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Saving';

      console.log('🚀 SENDING REVIEW REQUEST');

      fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          checks: checks,
          notes: textarea ? textarea.value : ''
        })
      })
        .then(parseResponse)
        .then(function (data) {
          console.log('✅ REVIEW SAVED SUCCESSFULLY');

          dirty = false;

          if (meta) {
            meta.innerHTML =
              'Last saved by <b>' +
              esc(data.reviewedBy || 'you') +
              '</b><br>' +
              esc(
                new Date(
                  data.reviewedAt || Date.now()
                ).toLocaleString('en-GB')
              );
          }

          var unlocked = data.complete && docsOk;

          setApprove(
            unlocked,
            unlocked
              ? 'Manual checklist complete. You can approve this mentor.'
              : (
                  !docsOk
                    ? 'Required documents are missing. Approval is locked.'
                    : 'Approval is locked until all required checks are done and saved.'
                )
          );

          toast(
            data.complete ? 'success' : 'info',
            data.message || 'Review saved successfully.'
          );
        })
        .catch(function (error) {
          console.error('❌ REVIEW SAVE ERROR:', error);

          toast(
            'error',
            error.message || 'Could not save review.'
          );
        })
        .finally(function () {
          saveBtn.disabled = false;

          saveBtn.innerHTML =
            '<i class="fas fa-floppy-disk"></i> Save review';
        });
    });

    refresh();
  } else {
    console.warn('⚠️ REVIEW FORM NOT FOUND');
  }

  /* ==========================================================
     4. APPROVE / REJECT / PENDING
  ========================================================== */

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-action]');

    if (!btn) return;

    var action = btn.dataset.action;

    var allowedActions = [
      'approve',
      'reject',
      'pending'
    ];

    if (allowedActions.indexOf(action) === -1) {
      return;
    }

    console.log('====================================');
    console.log('🔥 MENTOR DECISION BUTTON CLICKED');
    console.log('🎯 ACTION:', action);
    console.log('🆔 MENTOR ID:', btn.dataset.id);
    console.log('👤 MENTOR NAME:', btn.dataset.name);
    console.log('🔘 BUTTON DISABLED:', btn.disabled);
    console.log('====================================');

    if (btn.disabled) {
      console.warn('⚠️ Button is disabled. Request not sent.');
      return;
    }

    var mentorId = btn.dataset.id;
    var mentorName = btn.dataset.name || 'this mentor';

    if (!mentorId) {
      console.error('❌ MENTOR ID MISSING');
      toast('error', 'Mentor ID is missing.');
      return;
    }

    /* Approval confirmation */

    if (action === 'approve') {
      var confirmed = window.confirm(
        'Are you sure you want to approve ' +
        mentorName + '?'
      );

      if (!confirmed) {
        console.log('ℹ️ Approval cancelled by admin.');
        return;
      }
    }

    /* Reject reason */

    var payload = {};

    if (action === 'reject') {
      var reason = window.prompt(
        'Enter rejection reason (minimum 10 characters):'
      );

      if (reason === null) {
        console.log('ℹ️ Rejection cancelled.');
        return;
      }

      reason = reason.trim();

      if (reason.length < 10) {
        toast(
          'error',
          'Rejection reason must contain at least 10 characters.'
        );
        return;
      }

      payload.reason = reason;
    }

    /* Pending confirmation */

    if (action === 'pending') {
      if (!window.confirm(
        'Move ' + mentorName + ' back to pending?'
      )) {
        console.log('ℹ️ Pending action cancelled.');
        return;
      }
    }

    /* API request */

    var apiUrl =
      '/admin/mentors/' +
      encodeURIComponent(mentorId) +
      '/' +
      action;

    console.log('📡 API URL:', apiUrl);
    console.log('📦 REQUEST METHOD: PATCH');
    console.log('📦 REQUEST BODY:', payload);

    var originalHTML = btn.innerHTML;

    btn.disabled = true;

    btn.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> Processing...';

    console.log('🚀 SENDING MENTOR DECISION REQUEST');

    fetch(apiUrl, {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    })
      .then(parseResponse)
      .then(function (data) {
        console.log('====================================');
        console.log('✅ MENTOR ACTION SUCCESS');
        console.log('🎯 ACTION:', action);
        console.log('📥 SERVER MESSAGE:', data.message);
        console.log('====================================');

        toast(
          'success',
          data.message || 'Mentor updated successfully.'
        );

        console.log('🔄 RELOADING MENTOR DETAILS PAGE');

        window.setTimeout(function () {
          window.location.reload();
        }, 700);
      })
      .catch(function (error) {
        console.error('====================================');
        console.error('❌ MENTOR ACTION FAILED');
        console.error('🎯 ACTION:', action);
        console.error('❌ ERROR:', error);
        console.error('====================================');

        toast(
          'error',
          error.message || 'Mentor action failed.'
        );

        btn.disabled = false;
        btn.innerHTML = originalHTML;
      });
  });

  console.log('✅ MENTOR DETAILS SCRIPT INITIALIZED');

})();
