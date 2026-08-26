import * as timelineService from './timeline.service.js'

export function getTimeline(req, res) {
  res.success(timelineService.getTimeline())
}
