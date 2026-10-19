/* ==========================================================
   MNCConnect Admin - client script
   Path: public/admin/js/admin.js
   ========================================================== */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  // ---------- Mobile sidebar ----------
  const sidebar = $("#sidebar");
  const overlay = $("#overlay");
  const setSidebar = (open) => {
    if (!sidebar) return;
    sidebar.classList.toggle("open", open);
    overlay && overlay.classList.toggle("show", open);
  };
  const menuBtn = $("#menuBtn");
  menuBtn && menuBtn.addEventListener("click", () => setSidebar(!sidebar.classList.contains("open")));
  overlay && overlay.addEventListener("click", () => setSidebar(false));

  // ---------- Toast ----------
  window.toast = function (message, type) {
    const wrap = $("#toasts");
    if (!wrap) return alert(message);
    const el = document.createElement("div");
    el.className = "toast " + (type || "info");
    const icon = type === "ok" ? "fa-circle-check" : type === "bad" ? "fa-circle-xmark" : "fa-circle-info";
    el.innerHTML = '<i class="fas ' + icon + '"></i><span></span>';
    el.querySelector("span").textContent = message;
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  };

  // ---------- Confirm modal (promise based) ----------
  const modal = $("#modal");
  window.confirmModal = function (opts) {
    return new Promise((resolve) => {
      if (!modal) return resolve({ ok: window.confirm(opts.message || "Are you sure?"), reason: "" });

      $("#modalTitle").textContent = opts.title || "Are you sure?";
      $("#modalMsg").textContent = opts.message || "";
      const reasonWrap = $("#modalReasonWrap");
      const reasonInput = $("#modalReason");
      const okBtn = $("#modalOk");
      const cancelBtn = $("#modalCancel");

      reasonWrap.style.display = opts.reason ? "block" : "none";
      reasonInput.value = "";
      okBtn.textContent = opts.confirmText || "Confirm";
      okBtn.className = "btn " + (opts.danger ? "btn-bad" : "btn-ok");
      modal.classList.add("show");
      opts.reason && setTimeout(() => reasonInput.focus(), 50);

      const close = (ok) => {
        modal.classList.remove("show");
        okBtn.removeEventListener("click", onOk);
        cancelBtn.removeEventListener("click", onCancel);
        modal.removeEventListener("click", onBack);
        document.removeEventListener("keydown", onKey);
        resolve({ ok, reason: reasonInput.value.trim() });
      };
      const onOk = () => close(true);
      const onCancel = () => close(false);
      const onBack = (e) => { if (e.target === modal) close(false); };
      const onKey = (e) => { if (e.key === "Escape") close(false); };

      okBtn.addEventListener("click", onOk);
      cancelBtn.addEventListener("click", onCancel);
      modal.addEventListener("click", onBack);
      document.addEventListener("keydown", onKey);
    });
  };

  // ---------- API helper ----------
  async function api(url, method, body) {
    const res = await fetch(url, {
      method: method,
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      credentials: "same-origin",
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      window.location.href = "/admin/login";
      throw new Error("Session expired");
    }
    if (!res.ok || !data.success) throw new Error(data.message || "Request failed");
    return data;
  }

  const ACTIONS = {
    approve: { title: "Approve mentor?", confirmText: "Approve", danger: false, reason: false },
    reject: { title: "Reject mentor?", confirmText: "Reject", danger: true, reason: true },
    pending: { title: "Move back to pending?", confirmText: "Move to pending", danger: false, reason: false },
  };

  // ---------- Click actions ----------
  document.addEventListener("click", async (e) => {
    // Copy to clipboard
    const copyBtn = e.target.closest("[data-copy]");
    if (copyBtn) {
      try {
        await navigator.clipboard.writeText(copyBtn.dataset.copy);
        toast("Copied to clipboard", "ok");
      } catch (_) {
        toast("Copy failed", "bad");
      }
      return;
    }

    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    const name = btn.dataset.name || "this item";

    try {
      // Mentor approve / reject / pending
      if (ACTIONS[action]) {
        const cfg = ACTIONS[action];
        const res = await confirmModal({
          title: cfg.title,
          message: "Mentor: " + name,
          confirmText: cfg.confirmText,
          danger: cfg.danger,
          reason: cfg.reason,
        });
        if (!res.ok) return;
        btn.disabled = true;
        const data = await api("/admin/mentors/" + encodeURIComponent(id) + "/" + action, "PATCH", { reason: res.reason });
        toast(data.message, "ok");
        setTimeout(() => location.reload(), 700);
        return;
      }

      // User activate / deactivate
      if (action === "toggle-user") {
        const make = btn.dataset.next === "deactivate" ? "deactivate" : "activate";
        const res = await confirmModal({
          title: make === "deactivate" ? "Deactivate user?" : "Activate user?",
          message: name,
          confirmText: make === "deactivate" ? "Deactivate" : "Activate",
          danger: make === "deactivate",
        });
        if (!res.ok) return;
        btn.disabled = true;
        const data = await api("/admin/users/" + encodeURIComponent(id) + "/toggle", "PATCH");
        toast(data.message, "ok");
        setTimeout(() => location.reload(), 600);
      }
    } catch (err) {
      btn.disabled = false;
      toast(err.message || "Something went wrong", "bad");
    }
  });

  // ---------- Bulk selection (mentors) ----------
  const checkAll = $("#checkAll");
  const bulkBar = $("#bulkBar");
  const selected = () => $$(".row-check:checked").map((c) => c.value);
  const refreshBulk = () => {
    if (!bulkBar) return;
    const n = selected().length;
    $("#bulkCount").textContent = n;
    bulkBar.classList.toggle("show", n > 0);
  };
  checkAll && checkAll.addEventListener("change", () => {
    $$(".row-check").forEach((c) => (c.checked = checkAll.checked));
    refreshBulk();
  });
  $$(".row-check").forEach((c) => c.addEventListener("change", refreshBulk));

  $$("[data-bulk]").forEach((b) =>
    b.addEventListener("click", async () => {
      const action = b.dataset.bulk;
      const ids = selected();
      if (!ids.length) return;
      const cfg = ACTIONS[action];
      const res = await confirmModal({
        title: cfg.title.replace("mentor", ids.length + " mentor(s)"),
        message: "This will update all selected mentors.",
        confirmText: cfg.confirmText,
        danger: cfg.danger,
        reason: cfg.reason,
      });
      if (!res.ok) return;
      b.disabled = true;
      try {
        const data = await api("/admin/mentors/bulk", "POST", { ids, action, reason: res.reason });
        toast(data.message, data.failed ? "info" : "ok");
        setTimeout(() => location.reload(), 800);
      } catch (err) {
        b.disabled = false;
        toast(err.message, "bad");
      }
    })
  );

  // ---------- Filters ----------
  $$("[data-autosubmit]").forEach((el) => el.addEventListener("change", () => el.form && el.form.submit()));

  // Press "/" to focus search
  document.addEventListener("keydown", (e) => {
    const t = e.target.tagName;
    if (e.key === "/" && t !== "INPUT" && t !== "TEXTAREA") {
      const s = $("input[name=search]");
      if (s) { e.preventDefault(); s.focus(); }
    }
  });
})();
