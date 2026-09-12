import * as companionService from './companion.service.js'

export async function getConsent(req, res, next) {
  try {
    res.success(companionService.getConsent(req.user.id))
  } catch (error) {
    next(error)
  }
}

export async function updateConsent(req, res, next) {
  try {
    res.success(companionService.updateConsent(req.user.id, req.body))
  } catch (error) {
    next(error)
  }
}

export async function listMemories(req, res, next) {
  try {
    res.success(companionService.listMemories(req.user.id))
  } catch (error) {
    next(error)
  }
}

export async function createMemory(req, res, next) {
  try {
    res.success(companionService.createMemory(req.user.id, req.body))
  } catch (error) {
    next(error)
  }
}

export async function updateMemory(req, res, next) {
  try {
    res.success(companionService.updateMemory(req.user.id, req.params.id, req.body))
  } catch (error) {
    next(error)
  }
}

export async function removeMemory(req, res, next) {
  try {
    res.success(companionService.removeMemory(req.user.id, req.params.id))
  } catch (error) {
    next(error)
  }
}

export async function listConversations(req, res, next) {
  try {
    res.success(companionService.listConversations(req.user.id))
  } catch (error) {
    next(error)
  }
}

export async function createConversation(req, res, next) {
  try {
    res.success(companionService.createConversation(req.user.id, req.body))
  } catch (error) {
    next(error)
  }
}

export async function getConversation(req, res, next) {
  try {
    res.success(companionService.getConversation(req.user.id, req.params.id))
  } catch (error) {
    next(error)
  }
}

export async function createMessage(req, res, next) {
  try {
    res.success(await companionService.createMessage(req.user.id, req.params.id, req.body))
  } catch (error) {
    next(error)
  }
}

export async function removeConversation(req, res, next) {
  try {
    res.success(companionService.removeConversation(req.user.id, req.params.id))
  } catch (error) {
    next(error)
  }
}
