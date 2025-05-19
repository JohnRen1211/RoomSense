// Scripts for room and inventory
  const supabaseClient = supabase.createClient(
    'https://vzubmycafgnjtwnjfpop.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6dWJteWNhZmduanR3bmpmcG9wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQzNDY2NTQsImV4cCI6MjA1OTkyMjY1NH0.fDzlvR0xT3Sm8BTlCnEbxC8WE8-H3ZBRxA9SeEViaeo'
  );
// Track real-time sensor state globally
let currentSensorData = {
  aircon: "Off",
  light: "Off",
  motion: "No Motion"
};
//end sensors
  let manualOverrides = {};
  let currentRoom = null;
  const inventoryItems = [
    { key: 'tv', label: 'TVs', column: 'tv_count' },
    { key: 'fan', label: 'Fans', column: 'fan_count' },
    { key: 'chair', label: 'Chairs', column: 'chair_count' },
    { key: 'monoblock', label: 'Monoblocks', column: 'monoblock_count' }
  ];
  let inventoryCounts = {};

  async function handleRoomClick(roomNumber, event) {
    try {
      currentRoom = roomNumber;
      
      document.querySelectorAll('.room-btn').forEach(btn => {
        btn.classList.remove('border-4', 'border-black', 'bg-blue-700', 'bg-blue-500');
      });
      if (event) {
        event.target.classList.add('border-4', 'border-black');
        event.target.classList.add('bg-blue-700');
      }

      await Promise.all([
        updateRoomStatus(roomNumber, event),
        loadInventory(roomNumber)
      ]);
      
      document.querySelector('#inventory-box')?.scrollIntoView({ 
        behavior: 'smooth' 
      });
    } catch (error) {
      console.error('Room handling error:', error);
      alert('Error loading room data');
    }
  }

  async function loadInventory(roomNumber) {
    const container = document.getElementById('inventory');
    if (!container) return;

    container.innerHTML = '<div class="text-gray-500">Loading inventory...</div>';

    try {
      const { data, error } = await supabaseClient
        .from('room_inventory2')
        .select('*')
        .eq('room', roomNumber)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      inventoryCounts = data ? {
        tv: data.tv_count || 0,
        fan: data.fan_count || 0,
        chair: data.chair_count || 0,
        monoblock: data.monoblock_count || 0
      } : { tv: 0, fan: 0, chair: 0, monoblock: 0 };

      renderInventory();
    } catch (error) {
      console.error('Inventory error:', error);
      container.innerHTML = '<div class="text-red-500">Error loading inventory</div>';
    }
  }

  function renderInventory() {
    const container = document.getElementById('inventory');
    if (!container || !currentRoom) return;

    container.innerHTML = inventoryItems.map(item => `
      <div class="flex items-center justify-between py-2 border-b">
        <span class="font-medium">${item.label}:</span>
        <input 
          type="number" 
          min="0" 
          value="${inventoryCounts[item.key] || 0}"
          class="w-20 px-2 py-1 border rounded text-center"
          onchange="updateInventory('${item.key}', this.value)"
        >
      </div>
    `).join('');
    
    document.getElementById('room-title').textContent = `Inventory for Room ${currentRoom}`;
  }

  async function updateInventory(itemKey, value) {
    const newCount = parseInt(value);
    if (isNaN(newCount)) return;

    try {
      const item = inventoryItems.find(i => i.key === itemKey);
      if (!item) throw new Error('Invalid inventory item');

      const { error } = await supabaseClient
        .from('room_inventory2')
        .upsert({ 
          room: currentRoom,
          [item.column]: newCount 
        }, { onConflict: 'room' });

      if (error) throw error;
      
      inventoryCounts[itemKey] = newCount;
      renderInventory();
    } catch (error) {
      console.error('Update error:', error);
      alert('Error updating inventory');
      renderInventory();
    }
  }

  function manualOverrideChanged() {
    const value = document.getElementById("overrideStatus").value;
    if (currentRoom) {
      manualOverrides[currentRoom] = value;
      updateRoomStatus(currentRoom);
    }
  }

  async function updateRoomStatus(room, event) {
    currentRoom = room;
    const roomStatusElement = document.getElementById("room-status");
    const roomNoElement = document.getElementById("room-no");
    const roomTypeElement = document.getElementById("room-type-details");
    const roomScheduleElement = document.getElementById("room-schedule");
    const occupiedByElement = document.getElementById("occupied-by");
    const instructorElement = document.getElementById("instructor");
    const scanIndicator = document.getElementById("scan-indicator");
    const scanLabel = document.getElementById("scan-label");

    resetScanIndicator();
    document.querySelectorAll("button").forEach(btn => {
      btn.classList.remove("border-4", "border-black");
    });
    if (event) event.target.classList.add("border-4", "border-black");

    roomStatusElement.textContent = 'LOADING...';
    roomStatusElement.style.color = 'gray';

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

    const mergedSchedules = [...originalData, ...manualData];
    const schedulesToShow = room === '315' ? mergedSchedules : mergedSchedules.filter(s => s.start_time && s.end_time);
    const scheduleContainer = document.getElementById("schedule-container");

    if (schedulesToShow.length === 0) {
      scheduleContainer.innerHTML = `
        <tr>
          <td colspan="5" class="px-4 py-2 text-center text-gray-500">
            No schedule found for this room.
          </td>
        </tr>`;
    } else {
      scheduleContainer.innerHTML = schedulesToShow.map(schedule => {
        const startTime = schedule.start_time
          ? new Date(schedule.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
          : 'TBD';
        const endTime = schedule.end_time
          ? new Date(schedule.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
          : 'TBD';
        const date = new Date(schedule.date).toLocaleDateString();
        return `
          <tr>
            <td class="px-4 py-2 border">${date}</td>
            <td class="px-4 py-2 border">${startTime} - ${endTime}</td>
            <td class="px-4 py-2 border">${schedule.subject}</td>
            <td class="px-4 py-2 border">${schedule.prof}</td>
            <td class="px-4 py-2 border">${schedule.section}</td>
          </tr>`;
      }).join('');
    }

    const now = new Date();
    const localNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
    const nowMs = localNow.getTime();

    const filterActiveSchedules = (schedules) => {
      if (room === '315') {
        return schedules.filter(s => {
          if (!s.start_time || !s.end_time) return true;
          const start = new Date(s.start_time).getTime();
          const end = new Date(s.end_time).getTime();
          return start <= nowMs && nowMs <= end;
        });
      } else {
        return schedules.filter(s => {
          if (!s.start_time || !s.end_time) return false;
          const start = new Date(s.start_time).getTime();
          const end = new Date(s.end_time).getTime();
          return start <= nowMs && nowMs <= end;
        });
      }
    };

    const originalNow = filterActiveSchedules(originalData).filter(s => s.room === room);
    const manualNow = filterActiveSchedules(manualData).filter(s => s.room === room);
    const allCurrent = [...manualNow, ...originalNow];
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

    function updateRoomDisplay(status, color, room, schedule = null) {
          // Sensor override for Room 315
  if (room === '315') {
    const sensorActive = currentSensorData.aircon === "On" || 
                        currentSensorData.light === "On";
    
    if (sensorActive) {
      status = 'OCCUPIED (SENSOR)';
      color = 'red';
    }
  }

  // Existing updates
      roomStatusElement.textContent = status;
      roomStatusElement.style.color = color;
      roomNoElement.textContent = `ROOM ${room}`;
      roomTypeElement.textContent = schedule?.subject || 'N/A';
      roomScheduleElement.textContent = schedule
        ? `${formatTimeTo12Hour(schedule.start_time)} - ${formatTimeTo12Hour(schedule.end_time)}, ${new Date(schedule.date).toLocaleDateString()}`
        : 'N/A';
      occupiedByElement.textContent = schedule?.section || 'N/A';
      instructorElement.textContent = schedule?.prof || 'N/A';
    }

    function resetScanIndicator() {
      scanIndicator.className = 'w-3 h-3 rounded-full bg-gray-400 inline-block';
      scanLabel.textContent = 'No scan';
    }
  }

  function formatTimeTo12Hour(timeString) {
    const date = new Date(timeString);
    let hours = date.getHours();
    let minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    minutes = minutes < 10 ? '0' + minutes : minutes;
    return `${hours}:${minutes} ${ampm}`;
  }

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

    // Add sensor check HERE 👇
    if (room === '315') {
      const sensorActive = currentSensorData.aircon === "On" || 
                         currentSensorData.light === "On";
      
      if (sensorActive) {
        button.classList.remove('bg-green-500', 'bg-yellow-500');
        button.classList.add('bg-red-500');
        return; // Skip schedule checks for Room 315
      }
    }

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

  function schedulesMatch(s1, s2) {
    return (
      s1.subject === s2.subject &&
      s1.prof === s2.prof &&
      s1.section === s2.section &&
      new Date(s1.start_time).getTime() === new Date(s2.start_time).getTime() &&
      new Date(s1.end_time).getTime() === new Date(s2.end_time).getTime()
    );
  }

  function findOverlappingNow(schedules, nowMs) {
    return schedules.filter(s => {
      const start = new Date(s.start_time).getTime();
      const end = new Date(s.end_time).getTime();
      return start <= nowMs && nowMs <= end;
    });
  }

  function allOverlappingSchedulesMatch(originalNow, manualNow) {
    if (originalNow.length === 0 || manualNow.length === 0) return false;
    return manualNow.every(manual =>
      originalNow.some(original => schedulesMatch(original, manual))
    );
  }

  document.addEventListener("DOMContentLoaded", () => {
    updateAllRoomButtons();
    setInterval(updateAllRoomButtons, 60000);
    handleRoomClick('300');
  });


  // Schedule management functions
  const SUPABASE_URL = 'https://vzubmycafgnjtwnjfpop.supabase.co';
  const SUPABASE_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6dWJteWNhZmduanR3bmpmcG9wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDM0NjY1NCwiZXhwIjoyMDU5OTIyNjU0fQ.c7xkLWthN-SHSjJjs22CDy45MvfEFGxH7A-JD4aOSxI';
  const TABLE_NAME = 'schedules_manualv2';

  function openModal() {
    document.getElementById("modal").classList.remove("hidden");
  }

  function closeModal() {
    document.getElementById("modal").classList.add("hidden");
    document.getElementById("scheduleForm").reset();
  }

  let currentSchedule = null;

  function editSchedule(schedule) {
    currentSchedule = schedule;
    document.getElementById("room").value = schedule.room;
    document.getElementById("date").value = schedule.date;
    document.getElementById("academicYear").value = schedule.academicYear || "";
    document.getElementById("semester").value = schedule.semester || "";
    document.getElementById("startTime").value = schedule.start_time ? new Date(schedule.start_time).toLocaleTimeString() : "";
    document.getElementById("endTime").value = schedule.end_time ? new Date(schedule.end_time).toLocaleTimeString() : "";
    document.getElementById("section").value = schedule.section;
    document.getElementById("subject").value = schedule.subject;
    document.getElementById("prof").value = schedule.prof;
    openModal('Edit');
  }

  async function saveSchedule(event) {
    event?.preventDefault?.();
    let room = document.getElementById("room").value.trim();
    let date = document.getElementById("date").value.trim();
    let academicYear = document.getElementById("academicYear").value.trim();
    let semester = document.getElementById("semester").value.trim();
    let startTime = document.getElementById("startTime").value.trim();
    let endTime = document.getElementById("endTime").value.trim();
    let yearLevel = document.getElementById("yearLevel").value.trim();
    let section = document.getElementById("section").value.trim();
    let combinedSection = `${yearLevel}-${section}`;
    let subject = document.getElementById("subject").value.trim();
    let prof = document.getElementById("prof").value.trim();
    if (prof === "Others") {
      prof = document.getElementById("customProf").value.trim();
    }

    if (!room || !date || !academicYear || !semester || !combinedSection || !subject || !prof) {
      alert("Please fill in all required fields before saving.");
      return;
    }

    const startDateTime = startTime ? new Date(`${date}T${startTime}`).toISOString() : null;
    const endDateTime = endTime ? new Date(`${date}T${endTime}`).toISOString() : null;
    const submitButton = document.getElementById("submitButton");
    if (submitButton) submitButton.disabled = true;

    try {
      const isEditing = currentSchedule !== null;
      const method = isEditing ? 'PATCH' : 'POST';
      const url = isEditing
        ? `${SUPABASE_URL}/rest/v1/${TABLE_NAME}?id=eq.${currentSchedule.id}`
        : `${SUPABASE_URL}/rest/v1/${TABLE_NAME}`;

      const dataToSend = {
        room,
        date,
        academicYear,
        semester,
        section: combinedSection,
        subject,
        prof
      };

      if (startDateTime) dataToSend.start_time = startDateTime;
      else dataToSend.start_time = null;

      if (endDateTime) dataToSend.end_time = endDateTime;
      else dataToSend.end_time = null;

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_API_KEY,
          'Authorization': `Bearer ${SUPABASE_API_KEY}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(dataToSend)
      });

      if (!response.ok) throw new Error(await response.text());

      alert(isEditing ? "Schedule updated!" : "Schedule saved!");
      closeModal();
      currentSchedule = null;

      if (currentRoom) await updateRoomStatus(currentRoom);
    } catch (err) {
      console.error("Save error:", err.message);
      alert("Failed: " + err.message);
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  }

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
    } catch (err) {
      console.error("Delete error:", err.message);
      alert("Delete error: " + err.message);
    }
  }

  function leaveRoom() {
    if (!currentRoom) {
      alert("Please select a room first.");
      return;
    }
    alert("Leave Room clicked for Room " + currentRoom);
    currentRoom = null;
    document.getElementById("add-schedule-btn").disabled = true;
    document.getElementById("toggle-schedule-view").disabled = true;
    document.getElementById('save-manual-schedule-btn').disabled = true;
    document.getElementById('save-original-schedule-btn').disabled = true;

    document.querySelectorAll(".toggle-button").forEach(btn => {
      btn.classList.remove("border-4", "border-black");
    });

    resetRoomDetailsPanel();
  }

  function resetRoomDetailsPanel() {
    document.getElementById("room-status").textContent = "UNKNOWN";
    document.getElementById("room-status").style.color = "";
    document.getElementById("room-no").textContent = "N/A";
    document.getElementById("occupied-by").textContent = "N/A";
    document.getElementById("room-type-details").textContent = "N/A";
    document.getElementById("room-schedule").textContent = "N/A";
    document.getElementById("instructor").textContent = "N/A";
    document.getElementById("scan-indicator").className =
      "w-3 h-3 rounded-full bg-gray-400 inline-block";
    document.getElementById("scan-label").textContent = "No scan";
  }

  function openModalForAddSchedule() {
    if (!currentRoom) {
      alert("Please select a room first.");
      return;
    }
    document.getElementById("modal").classList.remove("hidden");
    document.getElementById("room").value = currentRoom;
  }

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

  function removeSpecialChars(input) {
    const original = input.value;
    const cleaned = original
      .replace(/[^a-zA-Z0-9. ]/g, '')
      .replace(/\.(?=.*\.)/g, '');
    input.value = cleaned;
  }
            //Event listener
          document.addEventListener("DOMContentLoaded", async () => {
  // Add polling HERE 👇
  setInterval(async () => {
    await fetchLatestSensorData();
    if (currentRoom === '315') updateRoomStatus('315');
    updateAllRoomButtons();
  }, 3000);

  // Initial fetch
  fetchLatestSensorData();
});
//For sensors codes
   
      document.addEventListener("DOMContentLoaded", async () => {
        const SUPABASE_URL = 'https://vzubmycafgnjtwnjfpop.supabase.co';
        const SUPABASE_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6dWJteWNhZmduanR3bmpmcG9wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQzNDY2NTQsImV4cCI6MjA1OTkyMjY1NH0.fDzlvR0xT3Sm8BTlCnEbxC8WE8-H3ZBRxA9SeEViaeo';
  
        const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_API_KEY);
  
        async function fetchLatestSensorData() {
          const { data, error } = await client
            .from('comp_data')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1);
  
          if (error) {
            console.error('Error fetching latest data:', error);
            return;
          }
  
          if (data.length > 0) {
            const latest = data[0];
            document.getElementById('temperature').textContent = `Temperature: ${latest.temperature?.toFixed(1)} °C`;
            document.getElementById('humidity').textContent = `Humidity: ${latest.humidity?.toFixed(1)} %`;
            document.getElementById('light').textContent = `Light: ${latest.light}`;
            document.getElementById('timestamp').textContent = `Timestamp: ${new Date(latest.created_at).toLocaleString()}`;
  
            
            const temperatureStatus = latest.temperature < 33 ? 'On' : 'Off';
            const temperatureStatusElement = document.getElementById('temperature-status');
            temperatureStatusElement.textContent = `Aircon Status: ${temperatureStatus}`;
            temperatureStatusElement.className = `text-2xl font-semibold ${temperatureStatus === 'On' ? 'text-green-600' : 'text-red-600'}`;


            const lightStatus = latest.light > 50 ? 'On' : 'Off';
            const lightStatusElement = document.getElementById('light-status');
            lightStatusElement.textContent = `Light Status: ${lightStatus}`;
            lightStatusElement.className = `text-2xl font-semibold ${lightStatus === 'On' ? 'text-green-600' : 'text-red-600'}`;
  
            const motionStatus = latest.motion === 1 ? 'Motion Detected' : 'No Motion';
            const motionStatusElement = document.getElementById('motion-status');
            motionStatusElement.textContent = `Motion Status: ${motionStatus}`;
            motionStatusElement.className = `text-2xl font-semibold ${motionStatus === 'Motion Detected' ? 'text-green-600' : 'text-gray-500'}`;
          };
          // In fetchLatestSensorData() function:
if (data.length > 0) {
  const latest = data[0];
  
  // Update global sensor state
  currentSensorData = {
    aircon: latest.temperature < 33 ? "On" : "Off",
    light: latest.light > 50 ? "On" : "Off",
    motion: latest.motion === 1 ? "Motion Detected" : "No Motion"
  };
  
}    
        }
        fetchLatestSensorData();
      }); //Successfully fecthed data
      //Update

