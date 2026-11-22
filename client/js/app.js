
"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "http://localhost:5000/api";

  const state = {
    students: [],
    courses: [],
    results: [],
    pendingDelete: null,
    activeModal: null
  };

  const $ = (id) => document.getElementById(id);

  // -------------------------------------------------------
  // API
  // -------------------------------------------------------

  async function apiRequest(endpoint, options = {}) {
    const config = {
      method: options.method || "GET",
      headers: { "Content-Type": "application/json" }
    };

    if (options.body !== undefined) {
      config.body = JSON.stringify(options.body);
    }

    let response;

    try {
      response = await fetch(`${API_BASE}${endpoint}`, config);
    } catch {
      throw new Error("Cannot connect to the server. Make sure your backend is running on port 5000.");
    }

    const contentType = response.headers.get("content-type") || "";
    let payload = null;

    if (contentType.includes("application/json")) {
      payload = await response.json();
    } else {
      const text = await response.text();
      payload = text ? { message: text } : null;
    }

    if (!response.ok) {
      const message =
        payload?.message ||
        payload?.error ||
        payload?.errors?.[0]?.message ||
        `Request failed with status ${response.status}.`;

      throw new Error(message);
    }

    return payload;
  }

  function unwrap(payload, possibleKeys = []) {
    if (Array.isArray(payload)) return payload;

    if (payload && typeof payload === "object") {
      if (Array.isArray(payload.data)) return payload.data;

      for (const key of possibleKeys) {
        if (Array.isArray(payload[key])) return payload[key];
      }

      for (const key of possibleKeys) {
        if (payload[key] && typeof payload[key] === "object") {
          return payload[key];
        }
      }

      if (payload.data && typeof payload.data === "object") {
        return payload.data;
      }
    }

    return payload;
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[character]);
  }

  function initials(name) {
    return String(name || "Student")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "ST";
  }

  function formatNumber(value) {
    const number = Number(value);
    return Number.isFinite(number)
      ? number.toLocaleString("en-US", { maximumFractionDigits: 2 })
      : "0";
  }

  function getPercentage(obtained, total) {
    const score = Number(obtained);
    const maximum = Number(total);

    if (!Number.isFinite(score) || !Number.isFinite(maximum) || maximum <= 0) {
      return 0;
    }

    return (score / maximum) * 100;
  }

  function getGrade(percentage) {
    if (percentage >= 70) return { grade: "A", label: "Excellent" };
    if (percentage >= 60) return { grade: "B", label: "Very good" };
    if (percentage >= 50) return { grade: "C", label: "Good" };
    if (percentage >= 45) return { grade: "D", label: "Pass" };
    if (percentage >= 40) return { grade: "E", label: "Fair" };
    return { grade: "F", label: "Needs improvement" };
  }

  function showToast(message, type = "success") {
    const region = $("toastRegion");
    const toast = document.createElement("div");

    toast.className = `toast ${type === "error" ? "error" : ""}`;
    toast.innerHTML = `
      <span class="toast-mark">${type === "error" ? "!" : "✓"}</span>
      <div class="toast-content">
        <strong>${type === "error" ? "Something went wrong" : "All done"}</strong>
        <p>${escapeHTML(message)}</p>
      </div>
    `;

    region.appendChild(toast);

    window.setTimeout(() => {
      toast.remove();
    }, 4200);
  }

  function setButtonLoading(button, loading, loadingText = "Saving…") {
    if (!button) return;

    if (loading) {
      button.dataset.originalText = button.textContent.trim();
      button.disabled = true;
      button.textContent = loadingText;
    } else {
      button.disabled = false;
      button.textContent = button.dataset.originalText || "Save";
    }
  }

  // -------------------------------------------------------
  // NAVIGATION
  // -------------------------------------------------------

  const pageNames = {
    dashboard: "Dashboard",
    students: "Students",
    courses: "Courses",
    results: "Results"
  };

  function navigateTo(page) {
    if (!pageNames[page]) return;

    document.querySelectorAll(".page-section").forEach((section) => {
      section.classList.remove("active");
    });

    const target = $(`${page}Page`);
    if (target) target.classList.add("active");

    document.querySelectorAll(".nav-link").forEach((link) => {
      link.classList.toggle("active", link.dataset.page === page);
    });

    $("breadcrumbCurrent").textContent = pageNames[page];

    closeSidebar();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeSidebar() {
    $("sidebar").classList.remove("open");
    $("sidebarScrim").classList.remove("open");
  }

  document.querySelectorAll("[data-page]").forEach((element) => {
    element.addEventListener("click", () => {
      navigateTo(element.dataset.page);
    });
  });

  $("menuToggle").addEventListener("click", () => {
    $("sidebar").classList.toggle("open");
    $("sidebarScrim").classList.toggle("open");
  });

  $("sidebarScrim").addEventListener("click", closeSidebar);

  $("dashboardAddStudent").addEventListener("click", () => {
    openModal("studentModal");
  });

  // -------------------------------------------------------
  // MODALS
  // -------------------------------------------------------

  const modalConfig = {
    studentModal: {
      overlay: "studentModalOverlay",
      form: "studentForm",
      title: "studentModalTitle",
      addTitle: "Register a student",
      editTitle: "Edit student details",
      submit: "studentSubmit",
      addButton: "Save student",
      editButton: "Update student"
    },
    courseModal: {
      overlay: "courseModalOverlay",
      form: "courseForm",
      title: "courseModalTitle",
      addTitle: "Create a course",
      editTitle: "Edit course",
      submit: "courseSubmit",
      addButton: "Save course",
      editButton: "Update course"
    },
    resultModal: {
      overlay: "resultModalOverlay",
      form: "resultForm",
      title: "resultModalTitle",
      addTitle: "Record a result",
      editTitle: "Update result",
      submit: "resultSubmit",
      addButton: "Save result",
      editButton: "Update result"
    }
  };

  function openModal(modalId, editing = false) {
    const config = modalConfig[modalId];
    if (!config) return;

    if (state.activeModal && state.activeModal !== modalId) {
      closeModal(state.activeModal);
    }

    state.activeModal = modalId;

    $(config.title).textContent = editing ? config.editTitle : config.addTitle;
    $(config.submit).textContent = editing ? config.editButton : config.addButton;
    $(config.submit).disabled = false;

    const overlay = $(config.overlay);
    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");

    document.body.style.overflow = "hidden";

    window.setTimeout(() => {
      const firstInput = $(config.form)?.querySelector("input:not([type=hidden]), select");
      firstInput?.focus();
    }, 100);
  }

  function closeModal(modalId = state.activeModal) {
    const config = modalConfig[modalId];
    if (!config) return;

    const overlay = $(config.overlay);
    overlay.classList.remove("open");
    overlay.setAttribute("aria-hidden", "true");

    if (state.activeModal === modalId) {
      state.activeModal = null;
    }

    if (!state.activeModal) {
      document.body.style.overflow = "";
    }
  }

  document.querySelectorAll("[data-open-modal]").forEach((button) => {
    button.addEventListener("click", async () => {
      const modalId = button.dataset.openModal;

      if (modalId === "resultModal") {
        await populateResultSelects();
      }

      resetFormForAdd(modalId);
      openModal(modalId);
    });
  });

  document.querySelectorAll("[data-close-modal]").forEach((button) => {
    button.addEventListener("click", () => {
      const overlay = button.closest(".modal-overlay");
      if (!overlay) return;

      const modalId = Object.keys(modalConfig).find(
        (key) => modalConfig[key].overlay === overlay.id
      );

      closeModal(modalId);
    });
  });

  Object.values(modalConfig).forEach((config) => {
    $(config.overlay).addEventListener("click", (event) => {
      if (event.target === $(config.overlay)) {
        const modalId = Object.keys(modalConfig).find(
          (key) => modalConfig[key] === config
        );
        closeModal(modalId);
      }
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (state.activeModal) closeModal();
      closeConfirm();
    }
  });

  function resetFormForAdd(modalId) {
    const config = modalConfig[modalId];
    if (!config) return;

    $(config.form).reset();

    if (modalId === "studentModal") {
      $("studentId").value = "";
    }

    if (modalId === "courseModal") {
      $("courseId").value = "";
      $("courseCredits").value = "3";
    }

    if (modalId === "resultModal") {
      $("resultId").value = "";
      $("resultTotalMarks").value = "100";
      updateScorePreview();
    }
  }

  // -------------------------------------------------------
  // STUDENTS
  // -------------------------------------------------------

  async function loadStudents() {
    try {
      const payload = await apiRequest("/students");
      const data = unwrap(payload, ["students"]);
      state.students = Array.isArray(data) ? data : [];
      renderStudents();
      updateDashboard();
      updateNavigationCounts();
      return true;
    } catch (error) {
      showToast(error.message, "error");
      $("studentsTableBody").innerHTML =
        `<tr><td colspan="4" class="empty-cell">Unable to load students. Check your server connection.</td></tr>`;
      return false;
    }
  }

  function renderStudents() {
    const query = $("studentSearch").value.trim().toLowerCase();

    const filtered = state.students.filter((student) => {
      return [
        student.reg_no,
        student.name,
        student.email
      ].some((value) => String(value || "").toLowerCase().includes(query));
    });

    $("studentsTotal").textContent = state.students.length;
    $("studentsTableInfo").textContent =
      `Showing ${filtered.length} of ${state.students.length} students`;

    if (!filtered.length) {
      $("studentsTableBody").innerHTML = `
        <tr><td colspan="4" class="empty-cell">
          ${query ? "No students match your search." : "No student records yet. Add your first student to get started."}
        </td></tr>`;
      return;
    }

    $("studentsTableBody").innerHTML = filtered.map((student) => `
      <tr>
        <td>
          <div class="person-cell">
            <span class="person-avatar">${escapeHTML(initials(student.name))}</span>
            <span class="person-name">${escapeHTML(student.name)}</span>
          </div>
        </td>
        <td><strong>${escapeHTML(student.reg_no)}</strong></td>
        <td>${escapeHTML(student.email)}</td>
        <td>
          <div class="action-group">
            <button class="row-action" data-action="edit-student" data-id="${escapeHTML(student.reg_no)}" title="Edit student" aria-label="Edit student">
              <svg viewBox="0 0 24 24"><path d="m16 4 4 4M4 20l4-.8L19 8a2.1 2.1 0 0 0-3-3L5 16l-1 4Z"/></svg>
            </button>
            <button class="row-action delete" data-action="delete-student" data-id="${escapeHTML(student.reg_no)}" title="Delete student" aria-label="Delete student">
              <svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `).join("");
  }

  async function editStudent(regNo) {
    try {
      const payload = await apiRequest(`/students/${encodeURIComponent(regNo)}`);
      const student = unwrap(payload, ["student"]);

      if (!student || !student.reg_no) {
        throw new Error("Student record could not be found.");
      }

      $("studentId").value = student.reg_no;
      $("studentRegNo").value = student.reg_no;
      $("studentName").value = student.name || "";
      $("studentEmail").value = student.email || "";

      openModal("studentModal", true);
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  async function saveStudent(event) {
    event.preventDefault();

    const originalRegNo = $("studentId").value;
    const regNo = $("studentRegNo").value.trim();
    const body = {
      reg_no: regNo,
      name: $("studentName").value.trim(),
      email: $("studentEmail").value.trim()
    };

    if (!body.reg_no || !body.name || !body.email) {
      showToast("Please complete all student fields.", "error");
      return;
    }

    const button = $("studentSubmit");
    setButtonLoading(button, true);

    try {
      if (originalRegNo) {
        await apiRequest(`/students/${encodeURIComponent(originalRegNo)}`, {
          method: "PUT",
          body: { name: body.name, email: body.email }
        });
        showToast("Student details updated successfully.");
      } else {
        await apiRequest("/students", { method: "POST", body });
        showToast("Student registered successfully.");
      }

      closeModal("studentModal");
      await loadStudents();
      await loadResults();
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setButtonLoading(button, false);
    }
  }

  // -------------------------------------------------------
  // COURSES
  // -------------------------------------------------------

  async function loadCourses() {
    try {
      const payload = await apiRequest("/courses");
      const data = unwrap(payload, ["courses"]);
      state.courses = Array.isArray(data) ? data : [];
      renderCourses();
      updateDashboard();
      updateNavigationCounts();
      return true;
    } catch (error) {
      showToast(error.message, "error");
      $("coursesTableBody").innerHTML =
        `<tr><td colspan="4" class="empty-cell">Unable to load courses. Check your server connection.</td></tr>`;
      return false;
    }
  }

  function renderCourses() {
    const query = $("courseSearch").value.trim().toLowerCase();

    const filtered = state.courses.filter((course) => {
      return [
        course.title,
        course.code,
        course.credits
      ].some((value) => String(value ?? "").toLowerCase().includes(query));
    });

    $("coursesTotal").textContent = state.courses.length;
    $("coursesTableInfo").textContent =
      `Showing ${filtered.length} of ${state.courses.length} courses`;

    if (!filtered.length) {
      $("coursesTableBody").innerHTML = `
        <tr><td colspan="4" class="empty-cell">
          ${query ? "No courses match your search." : "No courses have been added yet. Create your first course."}
        </td></tr>`;
      return;
    }

    $("coursesTableBody").innerHTML = filtered.map((course) => `
      <tr>
        <td>
          <div class="person-cell">
            <span class="person-avatar" style="color:#4b90e7;background:#edf5ff">▤</span>
            <span class="person-name">${escapeHTML(course.title)}</span>
          </div>
        </td>
        <td><span class="course-code">${escapeHTML(course.code)}</span></td>
        <td>${escapeHTML(course.credits)} ${Number(course.credits) === 1 ? "credit" : "credits"}</td>
        <td>
          <div class="action-group">
            <button class="row-action" data-action="edit-course" data-id="${escapeHTML(course.id)}" title="Edit course" aria-label="Edit course">
              <svg viewBox="0 0 24 24"><path d="m16 4 4 4M4 20l4-.8L19 8a2.1 2.1 0 0 0-3-3L5 16l-1 4Z"/></svg>
            </button>
            <button class="row-action delete" data-action="delete-course" data-id="${escapeHTML(course.id)}" title="Delete course" aria-label="Delete course">
              <svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `).join("");
  }

  async function editCourse(id) {
    try {
      const payload = await apiRequest(`/courses/${encodeURIComponent(id)}`);
      const course = unwrap(payload, ["course"]);

      if (!course || course.id === undefined) {
        throw new Error("Course record could not be found.");
      }

      $("courseId").value = course.id;
      $("courseTitle").value = course.title || "";
      $("courseCode").value = course.code || "";
      $("courseCredits").value = course.credits ?? 3;

      openModal("courseModal", true);
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  async function saveCourse(event) {
    event.preventDefault();

    const id = $("courseId").value;
    const body = {
      title: $("courseTitle").value.trim(),
      code: $("courseCode").value.trim(),
      credits: Number($("courseCredits").value)
    };

    if (!body.title || !body.code || !Number.isInteger(body.credits) || body.credits < 1) {
      showToast("Enter a course title, code and valid credit units.", "error");
      return;
    }

    const button = $("courseSubmit");
    setButtonLoading(button, true);

    try {
      if (id) {
        await apiRequest(`/courses/${encodeURIComponent(id)}`, {
          method: "PUT",
          body
        });
        showToast("Course updated successfully.");
      } else {
        await apiRequest("/courses", { method: "POST", body });
        showToast("Course created successfully.");
      }

      closeModal("courseModal");
      await loadCourses();
      await populateResultSelects();
      await loadResults();
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setButtonLoading(button, false);
    }
  }

  // -------------------------------------------------------
  // RESULTS
  // -------------------------------------------------------

  async function loadResults() {
    try {
      const payload = await apiRequest("/results");
      const data = unwrap(payload, ["results"]);
      state.results = Array.isArray(data) ? data : [];
      renderResults();
      updateDashboard();
      return true;
    } catch (error) {
      showToast(error.message, "error");
      $("resultsTableBody").innerHTML =
        `<tr><td colspan="7" class="empty-cell">Unable to load results. Check your server connection.</td></tr>`;
      return false;
    }
  }

  function renderResults() {
    const query = $("resultSearch").value.trim().toLowerCase();

    const filtered = state.results.filter((result) => {
      return [
        result.student_name,
        result.student_id,
        result.course_title,
        result.course_id,
        result.marks_obtained,
        result.total_marks
      ].some((value) => String(value ?? "").toLowerCase().includes(query));
    });

    $("resultsTotal").textContent = state.results.length;
    $("resultsTableInfo").textContent =
      `Showing ${filtered.length} of ${state.results.length} results`;

    if (!filtered.length) {
      $("resultsTableBody").innerHTML = `
        <tr><td colspan="7" class="empty-cell">
          ${query ? "No results match your search." : "No assessment records yet. Record your first result to get started."}
        </td></tr>`;
      return;
    }

    $("resultsTableBody").innerHTML = filtered.map((result) => {
      const percentage = getPercentage(result.marks_obtained, result.total_marks);
      const grade = getGrade(percentage);

      return `
        <tr>
          <td>
            <div class="person-cell">
              <span class="person-avatar">${escapeHTML(initials(result.student_name || result.student_id))}</span>
              <span>
                <span class="person-name">${escapeHTML(result.student_name || "Unknown student")}</span>
                <span class="person-sub">${escapeHTML(result.student_id || "")}</span>
              </span>
            </div>
          </td>
          <td>${escapeHTML(result.course_title || `Course ${result.course_id}`)}</td>
          <td><span class="score-text">${formatNumber(result.marks_obtained)}</span></td>
          <td>${formatNumber(result.total_marks)}</td>
          <td><span class="percentage-cell">${percentage.toFixed(1)}%</span></td>
          <td><span class="grade-pill">${grade.grade} · ${grade.label}</span></td>
          <td>
            <div class="action-group">
              <button class="row-action" data-action="edit-result" data-id="${escapeHTML(result.id)}" title="Edit result" aria-label="Edit result">
                <svg viewBox="0 0 24 24"><path d="m16 4 4 4M4 20l4-.8L19 8a2.1 2.1 0 0 0-3-3L5 16l-1 4Z"/></svg>
              </button>
              <button class="row-action delete" data-action="delete-result" data-id="${escapeHTML(result.id)}" title="Delete result" aria-label="Delete result">
                <svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6"/></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  }

  async function populateResultSelects() {
    const studentSelect = $("resultStudent");
    const courseSelect = $("resultCourse");

    studentSelect.innerHTML = '<option value="">Select a student</option>';
    courseSelect.innerHTML = '<option value="">Select a course</option>';

    state.students.forEach((student) => {
      const option = document.createElement("option");
      option.value = student.reg_no;
      option.textContent = `${student.name} (${student.reg_no})`;
      studentSelect.appendChild(option);
    });

    state.courses.forEach((course) => {
      const option = document.createElement("option");
      option.value = course.id;
      option.textContent = `${course.title} (${course.code})`;
      courseSelect.appendChild(option);
    });
  }

  async function editResult(id) {
    try {
      await populateResultSelects();

      const payload = await apiRequest(`/results/${encodeURIComponent(id)}`);
      const result = unwrap(payload, ["result"]);

      if (!result || result.id === undefined) {
        throw new Error("Result record could not be found.");
      }

      $("resultId").value = result.id;
      $("resultStudent").value = result.student_id;
      $("resultCourse").value = String(result.course_id);
      $("resultMarksObtained").value = result.marks_obtained;
      $("resultTotalMarks").value = result.total_marks;

      updateScorePreview();
      openModal("resultModal", true);
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  async function saveResult(event) {
    event.preventDefault();

    const id = $("resultId").value;
    const studentId = $("resultStudent").value;
    const courseId = $("resultCourse").value;
    const marks = Number($("resultMarksObtained").value);
    const total = Number($("resultTotalMarks").value);

    if (!studentId || !courseId) {
      showToast("Select both a student and a course.", "error");
      return;
    }

    if (
      !Number.isFinite(marks) ||
      !Number.isFinite(total) ||
      marks < 0 ||
      total <= 0 ||
      marks > total
    ) {
      showToast("Marks must be valid, and obtained marks cannot exceed total marks.", "error");
      return;
    }

    const button = $("resultSubmit");
    setButtonLoading(button, true);

    try {
      if (id) {
        await apiRequest(`/results/${encodeURIComponent(id)}`, {
          method: "PUT",
          body: {
            marks_obtained: marks,
            total_marks: total
          }
        });
        showToast("Result updated successfully.");
      } else {
        await apiRequest("/results", {
          method: "POST",
          body: {
            student_id: studentId,
            course_id: Number(courseId),
            marks_obtained: marks,
            total_marks: total
          }
        });
        showToast("Result recorded successfully.");
      }

      closeModal("resultModal");
      await loadResults();
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setButtonLoading(button, false);
    }
  }

  function updateScorePreview() {
    const marks = Number($("resultMarksObtained").value);
    const total = Number($("resultTotalMarks").value);

    if (
      $("resultMarksObtained").value === "" ||
      $("resultTotalMarks").value === "" ||
      !Number.isFinite(marks) ||
      !Number.isFinite(total) ||
      total <= 0
    ) {
      $("scorePreviewValue").textContent = "—";
      return;
    }

    const percentage = getPercentage(marks, total);
    $("scorePreviewValue").textContent = `${percentage.toFixed(1)}% · Grade ${getGrade(percentage).grade}`;
  }

  // -------------------------------------------------------
  // DELETE CONFIRMATION
  // -------------------------------------------------------

  function askDelete(message, callback) {
    $("confirmMessage").textContent = message;
    state.pendingDelete = callback;
    $("confirmOverlay").classList.add("open");
    $("confirmOverlay").setAttribute("aria-hidden", "false");
  }

  function closeConfirm() {
    $("confirmOverlay").classList.remove("open");
    $("confirmOverlay").setAttribute("aria-hidden", "true");
    state.pendingDelete = null;
  }

  $("cancelDelete").addEventListener("click", closeConfirm);

  $("confirmOverlay").addEventListener("click", (event) => {
    if (event.target === $("confirmOverlay")) closeConfirm();
  });

  $("confirmDelete").addEventListener("click", async () => {
    if (!state.pendingDelete) return;

    const callback = state.pendingDelete;
    $("confirmDelete").disabled = true;
    $("confirmDelete").textContent = "Deleting…";

    try {
      await callback();
      closeConfirm();
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      $("confirmDelete").disabled = false;
      $("confirmDelete").textContent = "Delete record";
    }
  });

  async function deleteStudent(regNo) {
    await apiRequest(`/students/${encodeURIComponent(regNo)}`, {
      method: "DELETE"
    });

    showToast("Student deleted successfully.");
    await loadStudents();
    await loadResults();
  }

  async function deleteCourse(id) {
    await apiRequest(`/courses/${encodeURIComponent(id)}`, {
      method: "DELETE"
    });

    showToast("Course deleted successfully.");
    await loadCourses();
    await loadResults();
  }

  async function deleteResult(id) {
    await apiRequest(`/results/${encodeURIComponent(id)}`, {
      method: "DELETE"
    });

    showToast("Result deleted successfully.");
    await loadResults();
  }

  // -------------------------------------------------------
  // TABLE ACTIONS
  // -------------------------------------------------------

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;

    const id = button.dataset.id;
    const action = button.dataset.action;

    if (action === "edit-student") editStudent(id);

    if (action === "delete-student") {
      askDelete(
        "This will permanently remove the student record. Any associated results may also prevent deletion until they are removed.",
        () => deleteStudent(id)
      );
    }

    if (action === "edit-course") editCourse(id);

    if (action === "delete-course") {
      askDelete(
        "This will permanently remove the course. Existing results linked to this course may prevent deletion.",
        () => deleteCourse(id)
      );
    }

    if (action === "edit-result") editResult(id);

    if (action === "delete-result") {
      askDelete(
        "This assessment record will be permanently deleted. This action cannot be undone.",
        () => deleteResult(id)
      );
    }
  });

  // -------------------------------------------------------
  // DASHBOARD
  // -------------------------------------------------------

  function updateDashboard() {
    $("studentCount").textContent = formatNumber(state.students.length);
    $("courseCount").textContent = formatNumber(state.courses.length);
    $("resultCount").textContent = formatNumber(state.results.length);

    $("studentsTotal").textContent = state.students.length;
    $("coursesTotal").textContent = state.courses.length;
    $("resultsTotal").textContent = state.results.length;

    if (!state.results.length) {
      $("averageScore").textContent = "—";
    } else {
      const totalPercentage = state.results.reduce((sum, result) => {
        return sum + getPercentage(result.marks_obtained, result.total_marks);
      }, 0);

      $("averageScore").textContent =
        `${(totalPercentage / state.results.length).toFixed(1)}%`;
    }

    renderRecentResults();
  }

  function renderRecentResults() {
    const recent = [...state.results]
      .sort((a, b) => Number(b.id) - Number(a.id))
      .slice(0, 5);

    if (!recent.length) {
      $("recentResultsBody").innerHTML = `
        <tr><td colspan="4" class="empty-cell">Your latest assessment records will appear here.</td></tr>`;
      return;
    }

    $("recentResultsBody").innerHTML = recent.map((result) => {
      const percentage = getPercentage(result.marks_obtained, result.total_marks);
      const grade = getGrade(percentage);

      return `
        <tr>
          <td>
            <div class="person-cell">
              <span class="person-avatar">${escapeHTML(initials(result.student_name || result.student_id))}</span>
              <span class="person-name">${escapeHTML(result.student_name || result.student_id || "Unknown")}</span>
            </div>
          </td>
          <td>${escapeHTML(result.course_title || "Unknown course")}</td>
          <td><span class="score-text">${formatNumber(result.marks_obtained)}/${formatNumber(result.total_marks)}</span></td>
          <td><span class="grade-pill">${grade.grade}</span></td>
        </tr>
      `;
    }).join("");
  }

  function updateNavigationCounts() {
    $("studentNavCount").textContent = state.students.length;
    $("courseNavCount").textContent = state.courses.length;
  }

  // -------------------------------------------------------
  // SEARCH
  // -------------------------------------------------------

  $("studentSearch").addEventListener("input", renderStudents);
  $("courseSearch").addEventListener("input", renderCourses);
  $("resultSearch").addEventListener("input", renderResults);

  // -------------------------------------------------------
  // FORM EVENTS
  // -------------------------------------------------------

  $("studentForm").addEventListener("submit", saveStudent);
  $("courseForm").addEventListener("submit", saveCourse);
  $("resultForm").addEventListener("submit", saveResult);

  $("resultMarksObtained").addEventListener("input", updateScorePreview);
  $("resultTotalMarks").addEventListener("input", updateScorePreview);

  // -------------------------------------------------------
  // DATE AND INITIAL LOAD
  // -------------------------------------------------------

  $("todayDate").textContent = new Intl.DateTimeFormat("en-NG", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date());

  async function initialiseApp() {
    // Load the three resources independently. A failure in one
    // section should not stop the others from loading.
    await Promise.allSettled([
      loadStudents(),
      loadCourses(),
      loadResults()
    ]);

    updateDashboard();
    updateNavigationCounts();
  }

  initialiseApp();
});
