const requireAdminAuth = (req, res, next) => {
    try {
        // Check whether admin session exists
        if (!req.session || !req.session.admin) {
            return res.redirect("/admin/login");
        }

        // Check admin is properly authenticated
        if (!req.session.admin.id) {
            return res.redirect("/admin/login");
        }

        // Admin authenticated
        next();

    } catch (error) {
        console.error("Admin middleware error:", error);

        return res.redirect("/admin/login");
    }
};


module.exports = {
    requireAdminAuth
};