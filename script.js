const scenes = [];
scenes.push({
  num: 0,
  title: "N/A (click Next)",
  textLines: [],
});

function prevCue() {
  currentCue--;
  if (currentCue < 0) {
    currentCue = cuePracticeLines.length - 1;
  }

  currentCue--;
  next();
}

function randomCue() {
  currentCue = Math.floor(Math.random() * cuePracticeLines.length);
  next();
}

function nextScene() {
  const currentSceneNum = cuePracticeLines[currentCue].sceneNumber;
  for (let i = currentCue+1; i < cuePracticeLines.length; i++) {
    const searchSceneNum = cuePracticeLines[i].sceneNumber;
    if (searchSceneNum > currentSceneNum) {
      currentCue = i-1;
      next();
      return;
    }
  }

  currentCue = -1;
  next();
}

function sceneTopCues() {
  const sceneTopCues = [];
  let currentSceneNum = -1;
  for (let i = 0; i < cuePracticeLines.length; i++) {
    const thisSceneNum = cuePracticeLines[i].sceneNumber;
    if (thisSceneNum !== currentSceneNum) {
      sceneTopCues.push(i);
      currentSceneNum = thisSceneNum;
    }
  }

  return sceneTopCues;
}

function prevScene() {
  const sceneTops = sceneTopCues();
  if (currentCue === 0) {
    currentCue = sceneTops[sceneTops.length - 1]-1;
    next();
    return;
  }

  let skipBackCue = 0;
  for (let i = 0; i < sceneTops.length; i++) {
    if (sceneTops[i] < currentCue) {
      skipBackCue = sceneTops[i];
    } else {
      break;
    }
  }

  currentCue = skipBackCue-1;
  next();
}

const characters = [];
const cuePracticeLines = [];
let currentCue = -1;

function dialogStartCharacterName(textLine) {
  const isUpper = textLine === textLine.toUpperCase();
  const isNothing = textLine.trim() === "";
  const isSpecial = textLine.trim().startsWith(">");
  const characterName = textLine.split("(")[0].trim();
  if (isUpper && !isNothing && !isSpecial) {
    return characterName;
  } else {
    return "";
  }
}

function handleDialogLine(i, textLines) {
  const textLine = textLines[i].trim();
  const characterName = dialogStartCharacterName(textLine);
  if (!characterName) return false;

  if (!characters.includes(characterName)) {
    // new character
    characters.push(characterName);
  }

  const dialogLine = {
    type: "Dialog",
    textLine: "",
    character: characterName,
    parenthetical: "",
  };

  i++;
  const underDialogHeader = textLines[i].trim();
  if (underDialogHeader.startsWith("(")) {
    dialogLine.parenthetical = underDialogHeader;
    i++;
  }
  let done = false;
  let spokenLine = "";
  while (!done) {
    const dialogTextLine = textLines[i].trim();
    if (dialogTextLine === "") {
      done = true;
    } else {
      spokenLine += dialogTextLine + " ";
      i++;
    }
  }

  dialogLine.textLine = spokenLine.trim();
  return { dialogLine, newI: i };
}

function processLines(textLines) {
  const lines = [];
  for (let i = 0; i < textLines.length; i++) {
    const { dialogLine, newI } = handleDialogLine(i, textLines);
    if (dialogLine) {
      lines.push(dialogLine);
      i = newI;
    } else if (textLines[i].trim() !== "") {
      lines.push({
        type: "Stage Direction",
        textLine: textLines[i].trim(),
      });
    }
  }

  return lines;
}

function buildScenes(lines) {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (
      line.toLowerCase().startsWith("int.") ||
      line.toLowerCase().startsWith("ext.")
    ) {
      // new scene
      scenes.push({
        num: scenes.length,
        title: line,
        textLines: [],
      });
    } else {
      // existing scene
      const currentScene = scenes[scenes.length - 1];
      currentScene.textLines.push(line);
    }
  }

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    scene.lines = processLines(scene.textLines);
  }

  return scenes;
}

function buildCharacterCuePractice(characterNames, scenes) {
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    if (!scene.lines) continue;
    for (let j = 0; j < scene.lines.length; j++) {
      const line = scene.lines[j];
      if (line.type === "Dialog" && characterNames.includes(line.character)) {
        let currentPos = j - 1;
        let prevLine = scene.lines[currentPos];
        let cues = [prevLine];
        while (prevLine.type !== "Dialog" && currentPos > 0) {
          currentPos--;
          prevLine = scene.lines[currentPos];
          cues.unshift(prevLine);
        }
        cuePracticeLines.push({
          line,
          cues,
          sceneTitle: scene.title,
          sceneNumber: scene.num,
        });
      }
    }
  }
}

function lineToHtml(line) {
  if (line.type === "Stage Direction") {
    return `
<div class="stage-direction">
  ${line.textLine}
</div>
`;
  } else if (line.type === "Dialog") {
    return `
<div class="dialog">
  <p class="character">${line.character}</p>
  <p class="parenthetical">${line.parenthetical}</p>
  <p class="dialog-line">${line.textLine.split(" ").map(word => `<span>${word}</span>`).join(" ")}</p>
</div>`;
  }
}

function sanitizeTextForDiff(text) {
  let newText = "";
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (/[a-zA-Z]/.test(char)) {
      newText += char.toUpperCase();
    } else if (/\s/.test(char)) {
      newText += " ";
    } else if (/[.,!?;:()"]/.test(char)) {
      if (i > 0 && /[a-zA-Z]/.test(text[i-1]) && i < text.length - 1 && /[a-zA-Z]/.test(text[i+1])) {
        newText += " ";
      }
    }
  }

  return newText;
}

function generateDiff(guessLine, actualLine) {
  const sanitizedGuess = sanitizeTextForDiff(guessLine);
  const sanitizedActual = sanitizeTextForDiff(actualLine);
  const diff = Diff.diffWords(sanitizedGuess, sanitizedActual);

  const fragment = document.createElement("p");
  fragment.classList.add("diff-result");
  let numChanged = 0;
  let numUnchanged = 0;
  diff.forEach(part => {
    const span = document.createElement("span");
    span.textContent = part.value;
    if (part.added) {
      span.classList.add("added");
    } else if (part.removed) {
      span.classList.add("removed");
    }

    fragment.appendChild(span);
    if (part.added || part.removed) {
      numChanged += part.value.length;
    } else {
      numUnchanged += part.value.length;
    }
  });

  const pct = (numUnchanged / (numChanged + numUnchanged)) * 100;

  return { fragment, pct };
}

function guessLine() {
  const lineSection = document.querySelector("#line");
  const actualLine = lineSection.innerHTML;
  const input = document.createElement("textarea");
  input.placeholder = "Type your guess for the line here";
  const submitButton = document.querySelector("#guess-btn");
  submitButton.textContent = "Guess";
  submitButton.classList.add("showing");
  const revealLineButton = document.querySelector("#reveal-line-btn");
  revealLineButton.classList.remove("showing");
  const revealWordButton = document.querySelector("#reveal-word-btn");
  revealWordButton.classList.remove("showing");
  
  document.querySelectorAll("#btm-action button").forEach(btn => btn.classList.remove("showing"));
  submitButton.onclick = () => {
    const currentLine = cuePracticeLines[currentCue].line.textLine.trim().toLowerCase();
    const userGuess = input.value.trim().toLowerCase();
    
    const { fragment, pct } = generateDiff(currentLine, userGuess);
    const middleSection = document.getElementById("middle-section");
    lineSection.removeChild(input);

    submitButton.onclick = guessLine;
    middleSection.appendChild(fragment);
    const pctElement = document.createElement("span");
    pctElement.classList.add("pct-element");
    pctElement.textContent = `(${pct.toFixed(2)}% correct)`;
    middleSection.appendChild(pctElement);
    lineSection.innerHTML += actualLine;
    revealDialog();
  };

  lineSection.innerHTML = "";
  lineSection.appendChild(input);
  lineSection.classList.add("revealed");
  input.focus();
}

function revealWord() {
  document.getElementById("line").classList.add("revealed");
  document.getElementById("guess-btn").classList.remove("showing");
  const dialogLineElement = document.querySelector("#line .dialog-line");
  if (!dialogLineElement) return;
  const hiddenWords = dialogLineElement.querySelectorAll("span:not(.revealed)");
  const nextWord = hiddenWords[0];
  nextWord.classList.add("revealed");
  if (hiddenWords.length === 1) {
    document.getElementById("next-btn").classList.add("showing");
    document.getElementById("reveal-line-btn").classList.remove("showing");
    document.getElementById("reveal-word-btn").classList.remove("showing");
    document.getElementById("guess-btn").classList.remove("showing");
    return;
  };
}

function next() {
  currentCue++;
  if (currentCue >= cuePracticeLines.length) {
    currentCue = 0;
  }

  const currentCueData = cuePracticeLines[currentCue];
  const cuesHtml = currentCueData.cues.map(lineToHtml).join("");
  const lineHtml = lineToHtml(currentCueData.line);
  const cuesElement  =  document.getElementById("cues");
  cuesElement.classList.add("showing");
  cuesElement.innerHTML = cuesHtml;
  document.getElementById("line").innerHTML = lineHtml;
  const wordElements = document.querySelectorAll("#line .dialog-line span");
  wordElements.forEach(word => word.classList.remove("revealed"));
  document.getElementById("next-btn").classList.remove("showing");
  document.getElementById("current-scene").textContent = currentCueData.sceneNumber;
  document.getElementById("reveal-line-btn").classList.add("showing");
  document.getElementById("reveal-word-btn").classList.add("showing");
  document.getElementById("guess-btn").classList.add("showing");
  document.getElementById("line").classList.remove("revealed");
  document.getElementById("middle-section").innerHTML = "";
  document.querySelectorAll("#btm-action button").forEach(btn => btn.classList.add("showing"));
}

function revealDialog() {
  document.getElementById("line").classList.add("revealed");
  const wordElements = document.querySelectorAll("#line .dialog-line span");
  wordElements.forEach(word => word.classList.add("revealed"));
  document.getElementById("next-btn").classList.add("showing");
  document.getElementById("reveal-line-btn").classList.remove("showing");
  document.getElementById("reveal-word-btn").classList.remove("showing");
  document.querySelectorAll("#btm-action button").forEach(btn => btn.classList.remove("showing"));
  document.getElementById("guess-btn").classList.remove("showing");
}

function getScenesFromLocalStorage() {
  const scenes = localStorage.getItem("scenes");
  return scenes ? JSON.parse(scenes) : [];
}

function onFileUpload(event) {
  const file = event.target.files[0];
  const reader = new FileReader();
  reader.onload = function (e) {
    const text = e.target.result;
    const textLines = text.split("\n");
    const scenes = buildScenes(textLines);
    localStorage.setItem("scenes", JSON.stringify(scenes));
    location.reload();
  };

  reader.readAsText(file);

  const fileInput = document.getElementById("file-input");
  if (fileInput) {
    fileInput.style.display = "none";
  }

  const uploadIntro = document.getElementById("upload-intro");
  if (uploadIntro) {
    uploadIntro.style.display = "none";
  }
}

function clearScript() {
  localStorage.removeItem("scenes");
  localStorage.removeItem("characters");
  location.reload();
}

function clearCharacterSelections() {
  localStorage.removeItem("characters");
  location.reload();
}

async function characterSelector(characterNames) {
  return new Promise((resolve) => {
    const characterContainer = document.getElementById("character-selector");
    characterContainer.classList.add("showing");
    const optionContainer = characterContainer.querySelector(".options");
    for (let i = 0; i < characterNames.length; i++) {
      const character = characterNames[i];
      const inputP = document.createElement("p");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.id = `checkbox-${character}`;
      checkbox.name = `checkbox-${character}`;
      checkbox.value = character;
      const label = document.createElement("label");
      label.htmlFor = `checkbox-${character}`;
      label.textContent = character;
      inputP.appendChild(checkbox);
      inputP.appendChild(label);
      optionContainer.appendChild(inputP);
    }

    const submitCharacters = document.querySelector("#submit-characters");
    submitCharacters.classList.add("showing");
    submitCharacters.onclick = () => {
      const selectedCharacters = [];
      const checkboxes = optionContainer.querySelectorAll("input[type='checkbox']");
      checkboxes.forEach((checkbox) => {
        if (checkbox.checked) {
          selectedCharacters.push(checkbox.value);
        }
      });
      resolve(selectedCharacters);
      characterContainer.classList.remove("showing");
    };
  });
}

function getCharactersFromScenes(scenes) {
  const characterSet = new Set();
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    if (!scene.lines) continue;
    for (let j = 0; j < scene.lines.length; j++) {
      const line = scene.lines[j];
      if (line.type === "Dialog") {
        characterSet.add(line.character);
      }
    }
  }

  return Array.from(characterSet);
}

document.addEventListener("DOMContentLoaded", async () => {
  const storedScenes = getScenesFromLocalStorage();
  let scenes = [];
  if (storedScenes.length > 0) {
    scenes = storedScenes;
  } else {
    const fileIntroElement = document.getElementById("file-intro");
    if (fileIntroElement) {
      fileIntroElement.classList.add("showing");
    }

    const cuerElement = document.getElementById("cuer");
    if (cuerElement) {
      cuerElement.classList.remove("showing");
    }

    return;
  }

  const fileIntroElement = document.getElementById("file-intro");
  if (fileIntroElement) {
    fileIntroElement.classList.remove("showing");
  }

  let characterNamesFromStorage = localStorage.getItem("characters");
  let characterNamesForCues = [];
  if (characterNamesFromStorage) {
    characterNamesForCues = JSON.parse(characterNamesFromStorage);
  } else{
    const possibleCharacterNames = getCharactersFromScenes(scenes);
    characterNamesForCues = await characterSelector(possibleCharacterNames);
    characterNamesForCues = characterNamesForCues.map(name => name.trim().toUpperCase());
    localStorage.setItem("characters", JSON.stringify(characterNamesForCues));
  }

  const characterNamesSpan = document.getElementById("character-names");
  if (characterNamesSpan) {
    characterNamesSpan.textContent = characterNamesForCues.join(", ");
  }

  const cuerElement = document.getElementById("cuer");
  if (cuerElement) {
    cuerElement.classList.add("showing");
  }

  buildCharacterCuePractice(characterNamesForCues, scenes);
  document.getElementById("current-scene").textContent = scenes[0].title;
});
