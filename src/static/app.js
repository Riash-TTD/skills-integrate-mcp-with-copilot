document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const signupInfo = document.getElementById("signup-info");
  const messageDiv = document.getElementById("message");
  const authButton = document.getElementById("auth-button");
  const authStatus = document.getElementById("auth-status");
  const loginModal = document.getElementById("login-modal");
  const loginForm = document.getElementById("login-form");
  const cancelLoginButton = document.getElementById("cancel-login");
  const teacherUsernameInput = document.getElementById("teacher-username");
  const teacherPasswordInput = document.getElementById("teacher-password");

  let teacherToken = localStorage.getItem("teacherToken");
  let teacherUsername = localStorage.getItem("teacherUsername");

  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");

    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  function openLoginModal() {
    teacherUsernameInput.value = "";
    teacherPasswordInput.value = "";
    loginModal.classList.remove("hidden");
    teacherUsernameInput.focus();
  }

  function closeLoginModal() {
    loginModal.classList.add("hidden");
    loginForm.reset();
  }

  function updateAuthUi() {
    const isAuthenticated = Boolean(teacherToken && teacherUsername);
    const registerButtons = document.querySelectorAll(".delete-btn");

    if (isAuthenticated) {
      authButton.textContent = `🔒 Logout (${teacherUsername})`;
      authButton.setAttribute("aria-label", "Teacher logout");
      authStatus.textContent = `Logged in as ${teacherUsername}. Teacher edits are enabled.`;
      signupForm.classList.remove("hidden");
      signupInfo.classList.add("hidden");
      registerButtons.forEach((button) => {
        button.classList.remove("hidden");
      });
    } else {
      authButton.textContent = "👤 Teacher Login";
      authButton.setAttribute("aria-label", "Teacher login");
      authStatus.textContent =
        "Students can view participants. Teachers can edit registrations.";
      signupForm.classList.add("hidden");
      signupInfo.classList.remove("hidden");
      registerButtons.forEach((button) => {
        button.classList.add("hidden");
      });
    }
  }

  async function verifySession() {
    if (!teacherToken) {
      teacherUsername = null;
      updateAuthUi();
      return;
    }

    try {
      const response = await fetch("/auth/session", {
        headers: {
          "X-Teacher-Token": teacherToken,
        },
      });
      const session = await response.json();

      if (!session.authenticated) {
        teacherToken = null;
        teacherUsername = null;
        localStorage.removeItem("teacherToken");
        localStorage.removeItem("teacherUsername");
      } else {
        teacherUsername = session.username;
        localStorage.setItem("teacherUsername", teacherUsername);
      }
    } catch (error) {
      teacherToken = null;
      teacherUsername = null;
      localStorage.removeItem("teacherToken");
      localStorage.removeItem("teacherUsername");
      console.error("Error validating teacher session:", error);
    }

    updateAuthUi();
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";
      activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Create participants HTML with delete icons instead of bullet points
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span><button class="delete-btn ${teacherToken ? "" : "hidden"}" data-activity="${name}" data-email="${email}" title="Teacher-only unregister">❌</button></li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      // Add event listeners to delete buttons
      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });

      updateAuthUi();
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: {
            "X-Teacher-Token": teacherToken,
          },
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");

        // Refresh activities list to show updated participants
        fetchActivities();
      } else if (response.status === 401) {
        teacherToken = null;
        teacherUsername = null;
        localStorage.removeItem("teacherToken");
        localStorage.removeItem("teacherUsername");
        updateAuthUi();
        showMessage("Your teacher session is no longer valid. Please log in again.", "error");
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: {
            "X-Teacher-Token": teacherToken,
          },
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        signupForm.reset();

        // Refresh activities list to show updated participants
        fetchActivities();
      } else if (response.status === 401) {
        teacherToken = null;
        teacherUsername = null;
        localStorage.removeItem("teacherToken");
        localStorage.removeItem("teacherUsername");
        updateAuthUi();
        showMessage("Your teacher session expired. Please log in again.", "error");
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const payload = {
      username: teacherUsernameInput.value.trim(),
      password: teacherPasswordInput.value,
    };

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (response.ok) {
        teacherToken = result.token;
        teacherUsername = result.username;
        localStorage.setItem("teacherToken", teacherToken);
        localStorage.setItem("teacherUsername", teacherUsername);
        closeLoginModal();
        updateAuthUi();
        fetchActivities();
        showMessage(result.message, "success");
      } else {
        showMessage(result.detail || "Login failed", "error");
      }
    } catch (error) {
      showMessage("Could not log in right now. Please try again.", "error");
      console.error("Error logging in:", error);
    }
  });

  cancelLoginButton.addEventListener("click", closeLoginModal);

  loginModal.addEventListener("click", (event) => {
    if (event.target === loginModal) {
      closeLoginModal();
    }
  });

  authButton.addEventListener("click", async () => {
    if (!teacherToken || !teacherUsername) {
      openLoginModal();
      return;
    }

    try {
      const response = await fetch("/auth/logout", {
        method: "POST",
        headers: {
          "X-Teacher-Token": teacherToken,
        },
      });
      const result = await response.json();
      if (!response.ok) {
        showMessage(result.detail || "Failed to log out", "error");
        return;
      }
    } catch (error) {
      showMessage("Could not log out right now. Please try again.", "error");
      console.error("Error logging out:", error);
      return;
    }

    teacherToken = null;
    teacherUsername = null;
    localStorage.removeItem("teacherToken");
    localStorage.removeItem("teacherUsername");
    updateAuthUi();
    fetchActivities();
    showMessage("Logged out successfully.", "success");
  });

  // Initialize app
  verifySession().then(fetchActivities);
});
