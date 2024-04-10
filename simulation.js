document.addEventListener("DOMContentLoaded", function () {
	const canvas = document.getElementById("fieldCanvas");
	const ctx = canvas.getContext("2d");
	const width = canvas.width;
	const height = canvas.height;
	const potentialStrengthSlider = document.getElementById(
		"potentialStrengthSlider"
	);
	const potentialStrengthValue = document.getElementById(
		"potentialStrengthValue"
	);

	let dt = 2; // Refined time step
	let dx = 5; // Spatial step for higher resolution
	let fieldLineDensity = 6; //field line density (how many lines leave a positive charge)
	let gridSizeX = Math.floor(width / dx);
	let gridSizeY = Math.floor(height / dx);
	let selectedChargeIndex = null;
	let Ez = Array.from({ length: gridSizeX }, () => new Float32Array(gridSizeY));
	let Hx = Array.from({ length: gridSizeX }, () => new Float32Array(gridSizeY));
	let Hy = Array.from({ length: gridSizeX }, () => new Float32Array(gridSizeY));
	let visualizePotential = false; // State to track what we're visualizing
	let visualizeWaves = true;
	let visualizeFieldLines = true;
	let charges = []; // Stores {x, y, magnitude} for static charges
	let mode = "pulse"; // Default mode is 'pulse'

	// New event listeners for buttons
	document
		.getElementById("mode-positive")
		.addEventListener("click", function () {
			mode = "positive";
			currentMagnitude = parseFloat(
				document.getElementById("chargeMagnitude").value
			);
		});

	document
		.getElementById("mode-negative")
		.addEventListener("click", function () {
			mode = "negative";
			currentMagnitude = -parseFloat(
				document.getElementById("chargeMagnitude").value
			); // Negative value for negative charge
		});

	document.getElementById("mode-pulse").addEventListener("click", function () {
		mode = "pulse";
	});
	document
		.getElementById("chargeMagnitude")
		.addEventListener("input", function () {
			document.getElementById("chargeMagnitudeValue").textContent = this.value;
		});
	document.getElementById("mode-move").addEventListener("click", function () {
		mode = "move";
	});
	document.getElementById("mode-erase").addEventListener("click", function () {
		mode = "erase";
	});

	document
		.getElementById("inputDx")
		.addEventListener("change", function (event) {
			dx = Number(event.target.value);
			gridSizeX = Math.floor(width / dx);
			gridSizeY = Math.floor(height / dx);
			// Reset fields
			Ez = Array.from({ length: gridSizeX }, () => new Float32Array(gridSizeY));
			Hx = Array.from({ length: gridSizeX }, () => new Float32Array(gridSizeY));
			Hy = Array.from({ length: gridSizeX }, () => new Float32Array(gridSizeY));
			// Optionally reset charges here if needed
			charges = [];
			updateCFL();
			drawFields(); // Redraw the canvas to reflect the reset state
		});

	document
		.getElementById("inputDt")
		.addEventListener("change", function (event) {
			dt = Number(event.target.value);
			updateCFL();
		});

	document.getElementById("fld").addEventListener("change", function (event) {
		fieldLineDensity = Number(event.target.value);
	});

	document.getElementById("resetButton").addEventListener("click", function () {
		// Reset fields
		Ez = Array.from({ length: gridSizeX }, () => new Float32Array(gridSizeY));
		Hx = Array.from({ length: gridSizeX }, () => new Float32Array(gridSizeY));
		Hy = Array.from({ length: gridSizeX }, () => new Float32Array(gridSizeY));

		// Redraw the canvas to reflect the reset fields and charges
		drawFields(); // Assuming drawFields() redraws the entire canvas based on current state
	});

	document
		.getElementById("resetSimulationButton")
		.addEventListener("click", function () {
			// Reset time step and spatial resolution to default values if desired

			gridSizeX = Math.floor(width / dx);
			gridSizeY = Math.floor(height / dx);

			// Reset fields
			Ez = Array.from({ length: gridSizeX }, () => new Float32Array(gridSizeY));
			Hx = Array.from({ length: gridSizeX }, () => new Float32Array(gridSizeY));
			Hy = Array.from({ length: gridSizeX }, () => new Float32Array(gridSizeY));

			// Reset charges or any other simulation parameters
			charges = [];

			// Redraw the canvas to reflect the reset state
			drawFields();
		});

	document
		.getElementById("togglePotentialField")
		.addEventListener("click", function () {
			visualizePotential = !visualizePotential;
			drawFields(); // Redraw based on the new state
		});

	document.getElementById("toggleWaves").addEventListener("click", function () {
		visualizeWaves = !visualizeWaves;
		drawFields(); // Redraw based on the new state
	});

	document
		.getElementById("toggleFieldLines")
		.addEventListener("click", function () {
			visualizeFieldLines = !visualizeFieldLines;
			drawFields(); // Redraw based on the new state
		});

	potentialStrengthValue.textContent = potentialStrengthSlider.value;

	potentialStrengthSlider.addEventListener("input", function () {
		potentialStrengthValue.textContent = potentialStrengthSlider.value;
		// Use potentialStrengthSlider.value in your potential calculation
		// You may want to redraw the field to reflect the changes
		drawFields();
	});

	function calculatePotential(x, y) {
		let potential = 0;
		charges.forEach((charge) => {
			const distance = Math.sqrt(
				Math.pow(x - charge.x, 2) + Math.pow(y - charge.y, 2)
			);
			if (distance > 0) {
				// Avoid division by zero
				potential += charge.magnitude / distance;
			}
		});
		return potential;
	}

	function updateCFL() {
		// The wave speed in units of grid cells per time step is assumed to be 1
		const waveSpeed = 1;
		// Compute the CFL number based on the current dt and dx values
		const cflNumber = (waveSpeed * dt) / dx;

		// Update the CFL number display
		document.getElementById(
			"cflDisplay"
		).textContent = `CFL: ${cflNumber.toFixed(3)}`;

		// Update the stability status display based on the CFL number
		if (cflNumber > 1) {
			// If the CFL number is greater than 1, the simulation is unstable
			document.getElementById("cflStatus").textContent = "Unstable (CFL > 1)";
			document.getElementById("cflStatus").style.color = "red";
		} else if (cflNumber > 0.9) {
			// If the CFL number is between 0.9 and 1, the simulation may be unstable
			document.getElementById("cflStatus").textContent =
				"Possibly Unstable (0.9 < CFL ≤ 1)";
			document.getElementById("cflStatus").style.color = "orange";
		} else {
			// If the CFL number is less than or equal to 0.9, the simulation is stable
			document.getElementById("cflStatus").textContent = "Stable (CFL ≤ 0.9)";
			document.getElementById("cflStatus").style.color = "green";
		}
	}

	updateCFL();
	function updateFields() {
		// Update magnetic fields Hx, Hy based on Ez
		for (let i = 0; i < gridSizeX - 1; i++) {
			for (let j = 0; j < gridSizeY - 1; j++) {
				Hx[i][j] -= (dt * (Ez[i][j + 1] - Ez[i][j])) / dx;
				Hy[i][j] += (dt * (Ez[i + 1][j] - Ez[i][j])) / dx;
			}
		}

		// Temporarily store next Ez values to account for simultaneous update
		let nextEz = Array.from(
			{ length: gridSizeX },
			() => new Float32Array(gridSizeY)
		);

		// Update electric field Ez based on Hx, Hy, and static charges
		for (let i = 1; i < gridSizeX - 1; i++) {
			for (let j = 1; j < gridSizeY - 1; j++) {
				nextEz[i][j] =
					Ez[i][j] +
					(dt * (Hy[i][j] - Hy[i - 1][j] - (Hx[i][j] - Hx[i][j - 1]))) / dx;
			}
		}

		// Incorporate static charges directly into Ez
		charges.forEach((charge) => {
			// Ensure charge location is within bounds to avoid index out of range errors
			if (
				charge.x > 0 &&
				charge.x < gridSizeX &&
				charge.y > 0 &&
				charge.y < gridSizeY
			) {
				nextEz[charge.x][charge.y] += charge.magnitude; // Apply charge magnitude directly
			}
			if (charge.oscillating) {
				// Update magnitude based on sine wave and frequency
				charge.magnitude =
					charge.baseMagnitude *
					Math.sin(2 * Math.PI * charge.frequency * currentTime);
			}
		});

		// Apply simple reflective boundary conditions by mirroring field values at edges
		for (let j = 0; j < gridSizeY; j++) {
			nextEz[0][j] = nextEz[1][j]; // Left edge
			nextEz[gridSizeX - 1][j] = nextEz[gridSizeX - 2][j]; // Right edge
		}
		for (let i = 0; i < gridSizeX; i++) {
			nextEz[i][0] = nextEz[i][1]; // Top edge
			nextEz[i][gridSizeY - 1] = nextEz[i][gridSizeY - 2]; // Bottom edge
		}

		// Update Ez with the calculated values for the next time step
		Ez = nextEz;
	}

	function drawFieldLines() {
		//const fieldLineDensity = 6; // Determines how densely field lines are drawn around each charge
		const stepSize = 2; // Determines how far each step moves
		const maxLineLength = 1000; // Max steps to prevent infinite loops

		// Calculate electric field at a point (x, y) due to all charges
		function calculateElectricField(x, y) {
			let Ex = 0,
				Ey = 0; // Components of the electric field vector
			charges.forEach((charge) => {
				const distanceX = x - charge.x;
				const distanceY = y - charge.y;
				const rSquared = distanceX ** 2 + distanceY ** 2;
				const E = charge.magnitude / rSquared; // Simplified electric field magnitude
				const ExComponent = (E * distanceX) / Math.sqrt(rSquared);
				const EyComponent = (E * distanceY) / Math.sqrt(rSquared);
				Ex += ExComponent;
				Ey += EyComponent;
			});
			return { Ex, Ey };
		}

		// Function to draw a field line starting from a point (x, y)
		function drawFieldLineFrom(x, y) {
			let currentX = x;
			let currentY = y;
			ctx.beginPath();
			ctx.moveTo(currentX * dx, currentY * dx); // Convert grid coordinates to canvas

			for (let i = 0; i < maxLineLength; i++) {
				const { Ex, Ey } = calculateElectricField(currentX, currentY);
				const magnitude = Math.sqrt(Ex ** 2 + Ey ** 2);
				if (magnitude < 0.0001) break; // Stop if field is too weak

				// Normalize the electric field vector and move in its direction
				currentX += (Ex / magnitude) * stepSize;
				currentY += (Ey / magnitude) * stepSize;

				ctx.lineTo(currentX * dx, currentY * dx); // Convert grid coordinates to canvas

				// Stop drawing this line if it goes outside the canvas
				if (
					currentX < 0 ||
					currentX >= gridSizeX ||
					currentY < 0 ||
					currentY >= gridSizeY
				)
					break;
			}
			ctx.strokeStyle = "rgba(0, 0, 255, 0.75)";
			ctx.stroke();
		}

		// Draw field lines starting from positive charges
		charges
			.filter((charge) => charge.magnitude > 0)
			.forEach((charge) => {
				for (let i = 0; i < fieldLineDensity; i++) {
					const angle = (Math.PI * 2 * i) / fieldLineDensity; // Spread lines evenly in all directions
					const startX = charge.x + Math.cos(angle) * 0.1; // Offset start point slightly to avoid singularity
					const startY = charge.y + Math.sin(angle) * 0.1;
					drawFieldLineFrom(startX, startY);
				}
			});
	}

	function drawFields() {
		ctx.clearRect(0, 0, width, height);
		// Define maximum and minimum values for Ez to normalize the intensity values
		let potentialMap = [];
		let maxPotential = -Infinity,
			minPotential = Infinity;
		if (visualizePotential) {
			for (let i = 0; i < gridSizeX; i++) {
				potentialMap[i] = [];
				for (let j = 0; j < gridSizeY; j++) {
					const potential = calculatePotential(i, j);
					potentialMap[i][j] = potential;
					if (potential > maxPotential) maxPotential = potential;
					if (potential < minPotential) minPotential = potential;
				}
			}
			const potentialRange = maxPotential - minPotential;
			//const amplificationExponent = 0.5; // Tune this value to control the amplification

			for (let i = 0; i < gridSizeX; i++) {
				for (let j = 0; j < gridSizeY; j++) {
					let normalizedPotential =
						(potentialMap[i][j] - minPotential) / potentialRange;
					normalizedPotential =
						Math.sign(normalizedPotential) *
						Math.abs(normalizedPotential) **
							parseFloat(potentialStrengthSlider.value);
					let hue = 240 - (normalizedPotential * 0.5 + 0.5) * 240; // Adjust the mapping to use the full color range
					ctx.fillStyle = `hsla(${hue}, 100%, 50%, 0.75)`;
					ctx.fillRect(i * dx, j * dx, dx, dx);
				}
			}
		}

		if (visualizeWaves) {
			let maxEz = 0,
				minEz = 0;
			Ez.forEach((row) =>
				row.forEach((value) => {
					if (value > maxEz) maxEz = value;
					if (value < minEz) minEz = value;
				})
			);

			for (let i = 0; i < gridSizeX; i++) {
				for (let j = 0; j < gridSizeY; j++) {
					// Normalize intensity to be between 0 and 1 for color interpolation
					let normalizedIntensity = (Ez[i][j] - minEz) / (maxEz - minEz);
					// Calculate hue based on normalized intensity, mapping it across a spectrum
					let hue = normalizedIntensity * 240; // Example: maps to a spectrum from 0 (red) to 240 (blue)
					// Adjust saturation and lightness based on your preferences
					let saturation = 100;
					let lightness = 50;
					let alpha = Math.abs(Ez[i][j]) / maxEz; // Use absolute value to determine opacity

					ctx.fillStyle = `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`;
					ctx.fillRect(i * dx, j * dx, dx, dx);
				}
			}
		}
		if (visualizeFieldLines) {
			drawFieldLines();
		}

		//always render the charges
		charges.forEach((charge) => {
			const chargeColor = charge.magnitude > 0 ? "red" : "blue"; // Positive charges in red, negative in blue
			ctx.beginPath();
			ctx.arc(
				charge.x * dx + dx / 2,
				charge.y * dx + dx / 2,
				dx / 2,
				0,
				2 * Math.PI
			);
			ctx.fillStyle = chargeColor;
			ctx.fill();
		});
	}

	canvas.addEventListener("click", function (event) {
		const rect = canvas.getBoundingClientRect();
		const x = Math.floor((event.clientX - rect.left) / dx);
		const y = Math.floor((event.clientY - rect.top) / dx);
		const currentMagnitude = parseFloat(
			document.getElementById("chargeMagnitude").value
		);

		if (mode !== "move") {
			if (mode === "pulse") {
				Ez[x][y] = currentMagnitude; // Create a pulse
			} else if (mode === "positive" || mode === "negative") {
				const adjustedMagnitude =
					mode === "negative" ? -currentMagnitude : currentMagnitude;
				charges.push({ x, y, magnitude: adjustedMagnitude });
			}
		}
		if (mode === "erase") {
			// Find the closest charge to the click location
			let closestChargeIndex = -1;
			let closestDistance = Infinity;
			charges.forEach((charge, index) => {
				const distance = Math.sqrt(
					Math.pow(charge.x - x, 2) + Math.pow(charge.y - y, 2)
				);
				if (distance < closestDistance) {
					closestDistance = distance;
					closestChargeIndex = index;
				}
			});

			// Remove the closest charge if it's within a reasonable distance
			if (closestChargeIndex !== -1 && closestDistance < 5) {
				// Adjust the threshold as necessary
				charges.splice(closestChargeIndex, 1);
				drawFields(); // Redraw to reflect the change
			}
		}
	});

	canvas.addEventListener("mousedown", function (event) {
		if (mode === "move") {
			const rect = canvas.getBoundingClientRect();
			const mouseX = (event.clientX - rect.left) / dx;
			const mouseY = (event.clientY - rect.top) / dx;

			selectedChargeIndex = charges.findIndex(
				(charge) =>
					Math.sqrt((charge.x - mouseX) ** 2 + (charge.y - mouseY) ** 2) < 5 // Assuming 1 unit as the "selection radius"
			);

			if (selectedChargeIndex !== -1) {
				// If a charge is selected, listen for mouse movements on the canvas
				canvas.addEventListener("mousemove", moveCharge);
				// Listen for mouseup on the document to ensure it's captured regardless of cursor position
				document.addEventListener("mouseup", dropCharge, { once: true }); // Use { once: true } to automatically remove after firing
			}
			event.preventDefault(); // Prevents unwanted default actions, especially important if your canvas is inside a scrollable element
		}
	});

	function moveCharge(event) {
		if (selectedChargeIndex !== null) {
			const rect = canvas.getBoundingClientRect();
			charges[selectedChargeIndex].x = Math.floor(
				(event.clientX - rect.left) / dx
			);
			charges[selectedChargeIndex].y = Math.floor(
				(event.clientY - rect.top) / dx
			);
			drawFields(); // Redraw fields with the charge in the new position
		}
	}

	function dropCharge() {
		// When the mouse is released, stop moving the charge by removing the event listener
		canvas.removeEventListener("mousemove", moveCharge);
		// No need to remove this listener if using { once: true } in addEventListener
		selectedChargeIndex = null; // Reset selected charge index
	}

	function step() {
		updateFields();
		drawFields();
		requestAnimationFrame(step);
	}

	step();
});
