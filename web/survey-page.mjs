import {mountSurvey} from './survey-view.mjs';
import {mountPhotoViewer} from './photo-view.mjs';

async function main() {
  const response = await fetch('data.json');
  if (!response.ok) throw new Error('The preserved exhibit data could not be loaded.');
  const data = await response.json();
  const host = document.getElementById('survey-explorer');
  host.replaceChildren();
  mountSurvey(data.survey, data.geometry, data.survey_media, mountPhotoViewer(), data.history.remembrance.places, {
    reportPage:'index.html', alternatePage:'index.html', alternateLabel:'View this selection in the full El Reno report',
  });
}
main().catch(error => {
  document.getElementById('survey-explorer').textContent = error.message + ' Reload to try again, or read the full report using the link above.';
});
