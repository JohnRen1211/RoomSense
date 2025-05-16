//SCRIPT for this page
// Initialize Supabase client
    const supabaseClient = supabase.createClient(
        'https://vzubmycafgnjtwnjfpop.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6dWJteWNhZmduanR3bmpmcG9wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQzNDY2NTQsImV4cCI6MjA1OTkyMjY1NH0.fDzlvR0xT3Sm8BTlCnEbxC8WE8-H3ZBRxA9SeEViaeo'
    );
    
    let manualOverrides = {}; // Tracks manual override state for each room
    let currentRoom = null;   // Currently selected room for UI

    // Handle override dropdown change
    function manualOverrideChanged() {
        const value = document.getElementById("overrideStatus").value;
        if (currentRoom) {
            manualOverrides[currentRoom] = value;
            updateRoomStatus(currentRoom);
        }
    }

    // Updates the room status display and schedule table
    async function updateRoomStatus(room, event) {
        currentRoom = room;

        // DOM elements
        const roomStatusElement = document.getElementById("room-status");
        const roomNoElement = document.getElementById("room-no");
        const roomTypeElement = document.getElementById("room-type-details");
        const roomScheduleElement = document.getElementById("room-schedule");
        const occupiedByElement = document.getElementById("occupied-by");
        const instructorElement = document.getElementById("instructor");
        const representativeElement = document.getElementById("representative-details");
        const scanIndicator = document.getElementById("scan-indicator");
        const scanLabel = document.getElementById("scan-label");

        resetScanIndicator();

        // Highlight active room button
        document.querySelectorAll("button").forEach(btn => {
            btn.classList.remove("border-4", "border-red");
        });
        if (event) event.target.classList.add("border-4", "border-red");

        roomStatusElement.textContent = 'LOADING...';
        roomStatusElement.style.color = 'gray';

        // Fetch schedules from both sources
        const [{ data: originalData, error: originalError }, { data: manualData, error: manualError }] = await Promise.all([
            supabaseClient.from('schedules_originalv2').select('*').eq('room', room).order('start_time', { ascending: true }),
            supabaseClient.from('schedules_manualv2').select('*').eq('room', room).order('start_time', { ascending: true })
        ]);

        if (originalError || manualError) {
            console.error('Error fetching schedules:', originalError || manualError);
            roomStatusElement.textContent = 'Error loading schedule';
            roomStatusElement.style.color = 'red';
            return;
        }

        // Render schedule table
        const scheduleContainer = document.getElementById("schedule-container");
        if (originalData.length === 0 && manualData.length === 0) {
            scheduleContainer.innerHTML = `
                <tr>
                    <td colspan="5" class="px-4 py-2 text-center text-gray-500">
                        No schedule found for this room.
                    </td>
                </tr>`;
        } else {
const mergedSchedules = [...originalData, ...manualData].sort((a, b) => {
            // First sort by date
            const dateA = new Date(a.date || a.created_at || 0);
            const dateB = new Date(b.date || b.created_at || 0);
            
            // If dates are equal, sort by start time
            if (dateA - dateB === 0) {
                const timeA = new Date(a.start_time || a.time || 0);
                const timeB = new Date(b.start_time || b.time || 0);
                return timeA - timeB;
            }
            
            return dateA - dateB;
        });

scheduleContainer.innerHTML = mergedSchedules.map(schedule => {
    const startTime = new Date(schedule.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    const endTime = new Date(schedule.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    const date = new Date(schedule.date).toLocaleDateString();
    
    const isManual = schedule.source === 'manual' || schedule?.id; // You can enhance detection logic here if needed

    return `
        <tr>
            <td class="px-4 py-2 border">${date}</td>
            <td class="px-4 py-2 border">${startTime} - ${endTime}</td>
            <td class="px-4 py-2 border">${schedule.subject}</td>
            <td class="px-4 py-2 border">${schedule.prof}</td>
            <td class="px-4 py-2 border">${schedule.section}</td>
            ${
                isManual
                    ? `<td class="px-4 py-2 border text-red-500">
                        <button onclick="deleteSchedule(${schedule.id}, '${room}')" class="text-sm bg-red-500 text-white px-2 py-1 rounded">Delete</button>
                       </td>`
                    : `<td class="px-4 py-2 border text-gray-400 text-sm italic">System</td>`
            }
        </tr>`;
}).join('');

        }

// Get local time (Asia/Manila)
const now = new Date();
const localNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
const nowMs = localNow.getTime();

// Filter current active schedules
const originalNow = findOverlappingNow(originalData, nowMs).filter(s => s.room === room);
const manualNow = findOverlappingNow(manualData, nowMs).filter(s => s.room === room);
const allCurrent = [...manualNow, ...originalNow,];

const override = manualOverrides[room] || 'auto';

if (override === 'leave') {
    updateRoomDisplay('AVAILABLE 📘', 'green', room, null);
} else if (override === 'enter') {
    updateRoomDisplay('OCCUPIED', 'red', room, null);
} else {
    const originalConflict = checkConflictWithDetails(originalNow);
    const manualConflict = checkConflictWithDetails(manualNow);
    const bothHave = originalNow.length > 0 && manualNow.length > 0;
    const bothMatch = allOverlappingSchedulesMatch(originalNow, manualNow);

    if (originalConflict === 'yellow' || manualConflict === 'yellow') {
        updateRoomDisplay('CONFLICT ⚠️', 'yellow', room, allCurrent[0]);
    } else if (originalConflict === 'red' || manualConflict === 'red') {
        updateRoomDisplay('OCCUPIED', 'red', room, allCurrent[0]);
    } else if (bothHave && !bothMatch) {
        updateRoomDisplay('CONFLICT ⚠️', 'yellow', room, allCurrent[0]);
    } else if (bothHave && bothMatch) {
        updateRoomDisplay('OCCUPIED', 'red', room, allCurrent[0]);
    } else if (allCurrent.length > 0) {
        updateRoomDisplay('OCCUPIED', 'red', room, allCurrent[0]);
    } else {
        updateRoomDisplay('AVAILABLE', 'green', room, null);
    }
}


        // Updates text fields in the UI for ROOM details
        function updateRoomDisplay(status, color, room, schedule = null) {
            roomStatusElement.textContent = status;
            roomStatusElement.style.color = color;
            roomNoElement.textContent = `ROOM ${room}`;
            roomTypeElement.textContent = schedule?.subject || 'N/A';
            roomScheduleElement.textContent = schedule
                ? `${formatTimeTo12Hour(schedule.start_time)} - ${formatTimeTo12Hour(schedule.end_time)}, ${new Date(schedule.date).toLocaleDateString()}`
                : 'N/A';
            occupiedByElement.textContent = schedule?.section || 'N/A';
            instructorElement.textContent = schedule?.prof || 'N/A';
            representativeElement.textContent = schedule?.representative || 'N/A';
        }

        // Reset scan indicator UI
        function resetScanIndicator() {
            scanIndicator.className = 'w-3 h-3 rounded-full bg-gray-400 inline-block';
            scanLabel.textContent = 'No scan';
        }
    }//END of async update

    // Converts time string to 12-hour format
    function formatTimeTo12Hour(timeString) {
        const date = new Date(timeString);
        let hours = date.getHours();
        let minutes = date.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
        minutes = minutes < 10 ? '0' + minutes : minutes;
        return `${hours}:${minutes} ${ampm}`;
    }

    // Refreshes the status of all room buttons
    async function updateAllRoomButtons() {
        const roomNumbers = ['300', '310', '311', '312', '313', '314', '315', '316'];
        const now = new Date();
        const localNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
        const nowMs = localNow.getTime();

        const [{ data: originalData, error: originalError }, { data: manualData, error: manualError }] = await Promise.all([
            supabaseClient.from('schedules_originalv2').select('*'),
            supabaseClient.from('schedules_manualv2').select('*')
        ]);

        if (originalError || manualError) {
            console.error('Failed to fetch schedule data:', originalError || manualError);
            return;
        }

        roomNumbers.forEach(room => {
            const button = document.querySelector(`button[onclick*="'${room}'"]`);
            if (!button) return;

            const originalSchedules = originalData.filter(s => s.room === room);
            const manualSchedules = manualData.filter(s => s.room === room);

            const currentOriginal = findOverlappingNow(originalSchedules, nowMs);
            const currentManual = findOverlappingNow(manualSchedules, nowMs);
            const totalCurrent = [...currentOriginal, ...currentManual];

            button.classList.remove('bg-green-500', 'bg-red-500', 'bg-yellow-500');

            const originalConflict = checkConflictWithDetails(currentOriginal);
            const manualConflict = checkConflictWithDetails(currentManual);

            const bothHave = currentOriginal.length > 0 && currentManual.length > 0;
            const bothMatch = allOverlappingSchedulesMatch(currentOriginal, currentManual);

            if (originalConflict === 'yellow' || manualConflict === 'yellow') {
                button.classList.add('bg-yellow-500');
            } else if (originalConflict === 'red' || manualConflict === 'red') {
                button.classList.add('bg-red-500');
            } else if (bothHave && !bothMatch) {
                button.classList.add('bg-yellow-500');
            } else if (bothHave && bothMatch) {
                button.classList.add('bg-red-500');
            } else if (totalCurrent.length > 0) {
                button.classList.add('bg-red-500');
            } else {
                button.classList.add('bg-green-500');
            }
        });
    }

    // Detect internal conflicts with same or different details
    function checkConflictWithDetails(schedules) {
        for (let i = 0; i < schedules.length; i++) {
            for (let j = i + 1; j < schedules.length; j++) {
                const a = schedules[i];
                const b = schedules[j];

                const aStart = new Date(a.start_time).getTime();
                const aEnd = new Date(a.end_time).getTime();
                const bStart = new Date(b.start_time).getTime();
                const bEnd = new Date(b.end_time).getTime();

                const isOverlap = aStart < bEnd && bStart < aEnd;

                if (isOverlap) {
                    return schedulesMatch(a, b) ? 'red' : 'yellow';
                }
            }
        }
        return null;
    }

    // Compares if two schedules have matching details
    function schedulesMatch(s1, s2) {
        return (
            s1.subject === s2.subject &&
            s1.prof === s2.prof &&
            s1.representative === s2.representative &&
            s1.section === s2.section &&
            new Date(s1.start_time).getTime() === new Date(s2.start_time).getTime() &&
            new Date(s1.end_time).getTime() === new Date(s2.end_time).getTime()
        );
    }

    // Filters schedules overlapping with current time
    function findOverlappingNow(schedules, nowMs) {
        return schedules.filter(s => {
            const start = new Date(s.start_time).getTime();
            const end = new Date(s.end_time).getTime();
            return start <= nowMs && nowMs <= end;
        });
    }

    // Returns true if all overlapping schedules match exactly
    function allOverlappingSchedulesMatch(originalNow, manualNow) {
        if (originalNow.length === 0 || manualNow.length === 0) return false;
        return manualNow.every(manual =>
            originalNow.some(original => schedulesMatch(original, manual))
        );
    }
    //END of Buttons functions

    // Init auto refresh every minute
    document.addEventListener("DOMContentLoaded", updateAllRoomButtons);
    setInterval(updateAllRoomButtons, 60000);

//ADD Manual schedule in Room details
    const SUPABASE_URL = 'https://vzubmycafgnjtwnjfpop.supabase.co';
    const SUPABASE_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6dWJteWNhZmduanR3bmpmcG9wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDM0NjY1NCwiZXhwIjoyMDU5OTIyNjU0fQ.c7xkLWthN-SHSjJjs22CDy45MvfEFGxH7A-JD4aOSxI';
    const TABLE_NAME = 'schedules_manualv2';  // Updated to match table name

    function openModal() {
      document.getElementById("modal").classList.remove("hidden");
    }

    function closeModal() {
      document.getElementById("modal").classList.add("hidden");
      document.getElementById("scheduleForm").reset();
    }

    let currentSchedule = null;


    // Update schedule and display it in the table

// Edit schedule details
function editSchedule(schedule) {
    currentSchedule = schedule; // Store the schedule to edit
    document.getElementById("room").value = schedule.room;
    document.getElementById("date").value = schedule.date;
    document.getElementById("academicYear").value = schedule.academicYear || "";
    document.getElementById("semester").value = schedule.semester || "";
    document.getElementById("startTime").value = schedule.start_time ? new Date(schedule.start_time).toLocaleTimeString() : "";
    document.getElementById("endTime").value = schedule.end_time ? new Date(schedule.end_time).toLocaleTimeString() : "";
    document.getElementById("section").value = schedule.section;
    document.getElementById("subject").value = schedule.subject;
    document.getElementById("prof").value = schedule.prof;
    document.getElementById("representative").value = schedule.representative;
    openModal('Edit'); // Open modal in Edit mode
}

// Save schedule (both for add and edit)

// Save schedule (both for add and edit)
// Save schedule (both for add and edit)
async function saveSchedule(event) {
    event?.preventDefault?.();
    
    // Get values from the form
    let room = document.getElementById("room").value.trim();
    let date = document.getElementById("date").value.trim(); // Accept date as-is (string)
    let academicYear = document.getElementById("academicYear").value.trim();
    let semester = document.getElementById("semester").value.trim();
    let startTime = document.getElementById("startTime").value.trim();
    let endTime = document.getElementById("endTime").value.trim();

    // Convert times to ISO string format with time zone information
    const startDateTime = new Date(`${date}T${startTime}`).toISOString();
    const endDateTime = new Date(`${date}T${endTime}`).toISOString();

    // Combine Year Level and Section
    let yearLevel = document.getElementById("yearLevel").value.trim();
    let section = document.getElementById("section").value.trim();
    let combinedSection = `${yearLevel}-${section}`;

//Form others
let subject = document.getElementById("subject").value.trim();
let prof = document.getElementById("prof").value.trim();
if (prof === "Others") {
  prof = document.getElementById("customProf").value.trim();
}
let representative = document.getElementById("representative").value.trim();
if (representative === "Others") {
  representative = document.getElementById("customRepresentative").value.trim();
}

    // Validation check
    if (!room || !date || !academicYear || !startTime || !endTime || !semester || !combinedSection || !subject || !prof || !representative) {
        alert("Please fill in all fields before saving.");
        return;
    }

    const submitButton = document.getElementById("submitButton");
    if (submitButton) submitButton.disabled = true;

    try {
        const isEditing = currentSchedule !== null; // Check if we're editing
        const method = isEditing ? 'PATCH' : 'POST'; // Use PATCH for editing, POST for creating
        const url = isEditing
            ? `${SUPABASE_URL}/rest/v1/${TABLE_NAME}?id=eq.${currentSchedule.id}` // Update existing schedule
            : `${SUPABASE_URL}/rest/v1/${TABLE_NAME}`; // Create new schedule

        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_API_KEY,
                'Authorization': `Bearer ${SUPABASE_API_KEY}`,
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({
                room, date, academicYear, start_time: startDateTime, end_time: endDateTime,
                section: combinedSection, subject, prof, representative, semester
            })
        });

        if (!response.ok) throw new Error(await response.text());

        alert(isEditing ? "Schedule updated!" : "Schedule saved!");
        closeModal();
        currentSchedule = null; // Reset currentSchedule after saving or updating

    } catch (err) {
        console.error("Save error:", err.message);
        alert("Failed: " + err.message);
    } finally {
        if (submitButton) submitButton.disabled = false;
    }
}
// End of SAVE V1
    // Delete schedule
    async function deleteSchedule(id, room) {
        const confirmed = confirm("Are you sure you want to delete this schedule?");
        if (!confirmed) return;

        try {
            const response = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE_NAME}?id=eq.${id}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_API_KEY,
                    'Authorization': `Bearer ${SUPABASE_API_KEY}`,
                    'Prefer': 'return=representation'
                }
            });

            if (!response.ok) throw new Error(await response.text());

            alert("Schedule deleted.");
            updateSchedule(room);
        } catch (err) {
            console.error("Delete error:", err.message);
            alert("Delete error: " + err.message);
        }
    }
      // Initialize Supabase client

      // Called when a room button is clicked
      async function roomClicked(room, event) {
        currentRoom = room;

        // Highlight selected room button, clear others
        document.querySelectorAll(".toggle-button").forEach((btn) => {
          btn.classList.remove("border-4", "border-black");
        });
        if (event) event.target.classList.add("border-4", "border-black");

        // Enable the Add Schedule and Leave Room buttons
        document.getElementById("add-schedule-btn").disabled = false;
        document.getElementById("toggle-schedule-view").disabled = false;
        // Update the room details panel with data
        await updateRoomStatus(room, event);
      }

      // Override Leave Room functionality (simple example)
      function leaveRoom() {
        if (!currentRoom) {
          alert("Please select a room first.");
          return;
        }
        alert("Leave Room clicked for Room " + currentRoom);
        // You can implement actual leave logic here

        // Optionally reset currentRoom and disable buttons
        currentRoom = null;
        document.getElementById("add-schedule-btn").disabled = true;
        document.getElementById("toggle-schedule-view").disabled = true;

        // Unselect room button highlight
        document.querySelectorAll(".toggle-button").forEach((btn) => {
          btn.classList.remove("border-4", "border-black");
        });

        // Reset room details panel back to default
        resetRoomDetailsPanel();
      }

      // Reset room details panel text when no room is selected
      function resetRoomDetailsPanel() {
        document.getElementById("room-status").textContent = "UNKNOWN";
        document.getElementById("room-status").style.color = "";
        document.getElementById("room-no").textContent = "N/A";
        document.getElementById("occupied-by").textContent = "N/A";
        document.getElementById("room-type-details").textContent = "N/A";
        document.getElementById("room-schedule").textContent = "N/A";
        document.getElementById("instructor").textContent = "N/A";
        document.getElementById("representative-details").textContent = "N/A";
        document.getElementById("scan-indicator").className =
          "w-3 h-3 rounded-full bg-gray-400 inline-block";
        document.getElementById("scan-label").textContent = "No scan";
      }

      // Open modal for adding schedule, sets selected room
      function openModalForAddSchedule() {
        if (!currentRoom) {
          alert("Please select a room first.");
          return;
        }
        document.getElementById("modal").classList.remove("hidden");

        // Set room input value in modal and make it readonly
        document.getElementById("room").value = currentRoom;
      }

      function closeModal() {
        document.getElementById("modal").classList.add("hidden");
        document.getElementById("scheduleForm").reset();
      }

  //Add others in form
  function toggleCustomProf() {
  const profDropdown = document.getElementById("prof");
  const customProfInput = document.getElementById("customProf");
  if (profDropdown.value === "Others") {
    customProfInput.classList.remove("hidden");
    customProfInput.required = true;
  } else {
    customProfInput.classList.add("hidden");
    customProfInput.required = false;
  }
}
alert(isEditing ? "Schedule updated!" : "Schedule saved!");

//Add other in form representative
  function toggleCustomRepresentative() {
  const representativeDropdown = document.getElementById("representative");
  const customRepresentativeInput = document.getElementById("customRepresentative");
  if (representativeDropdown.value === "Others") {
    customRepresentativeInput.classList.remove("hidden");
    customRepresentativeInput.required = true;
  } else {
    customRepresentativeInput.classList.add("hidden");
    customRepresentativeInput.required = false;
  }
}
alert(isEditing ? "Schedule updated!" : "Schedule saved!");

//special characters
function removeSpecialChars(input) {
  const original = input.value;
  const cleaned = original
    .replace(/[^a-zA-Z0-9. ]/g, '') // Allow letters, digits, space, dot
    .replace(/\.(?=.*\.)/g, '');    // Allow only one dot (remove all but the first)
  input.value = cleaned;
}



