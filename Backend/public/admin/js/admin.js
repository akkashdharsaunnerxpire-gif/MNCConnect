document.addEventListener("DOMContentLoaded", function () {

    const approveBtn = document.getElementById("approveMentorBtn");
    const rejectBtn = document.getElementById("rejectMentorBtn");

    // ============================================================
    // APPROVE MENTOR
    // ============================================================

    if (approveBtn) {

        approveBtn.addEventListener("click", async function () {

            const mentorId = this.dataset.mentorId;

            if (!confirm("Are you sure you want to approve this mentor?")) {
                return;
            }

            try {

                this.disabled = true;

                this.innerHTML =
                    '<i class="fas fa-spinner fa-spin"></i> Approving...';

                const response = await fetch(
                    `/admin/mentors/${mentorId}/approve`,
                    {
                        method: "PATCH",
                        headers: {
                            "Content-Type": "application/json"
                        }
                    }
                );

                const data = await response.json();

                if (!response.ok || !data.success) {
                    throw new Error(
                        data.message || "Unable to approve mentor."
                    );
                }

                alert(
                    data.message || "Mentor approved successfully."
                );

                window.location.reload();

            } catch (error) {

                console.error("Approve mentor error:", error);

                alert(error.message);

                this.disabled = false;

                this.innerHTML =
                    '<i class="fas fa-check"></i> Approve Mentor';
            }
        });
    }


    // ============================================================
    // REJECT MENTOR
    // ============================================================

    if (rejectBtn) {

        rejectBtn.addEventListener("click", async function () {

            const mentorId = this.dataset.mentorId;

            if (!confirm("Are you sure you want to reject this mentor?")) {
                return;
            }

            try {

                this.disabled = true;

                this.innerHTML =
                    '<i class="fas fa-spinner fa-spin"></i> Rejecting...';

                const response = await fetch(
                    `/admin/mentors/${mentorId}/reject`,
                    {
                        method: "PATCH",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            reason: "Rejected by admin."
                        })
                    }
                );

                const data = await response.json();

                if (!response.ok || !data.success) {
                    throw new Error(
                        data.message || "Unable to reject mentor."
                    );
                }

                alert(
                    data.message || "Mentor rejected successfully."
                );

                window.location.reload();

            } catch (error) {

                console.error("Reject mentor error:", error);

                alert(error.message);

                this.disabled = false;

                this.innerHTML =
                    '<i class="fas fa-times"></i> Reject Mentor';
            }
        });
    }

});