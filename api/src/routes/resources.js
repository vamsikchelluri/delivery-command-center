// api/src/routes/resources.js — fixed version
// Key fixes:
// 1. Onsite resources: costInput is USD (hourly or annual salary), not INR
// 2. rateCurrency set correctly based on location
// 3. Status change endpoint added
// 4. firstName + lastName split in form (name = firstName + ' ' + lastName)

const router  = require('express').Router();
const prisma  = require('../lib/prisma');

// ── LIST ─────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { status, location, search } = req.query;
  const where = {};
  if (status)   where.status   = status;
  if (location) where.location = location;
  if (search)   where.name     = { contains: search, mode: 'insensitive' };

  const resources = await prisma.resource.findMany({
    where,
    include: {
      primarySkill: true,
      secondarySkills: { include: { skill: true } },
      deployments: {
        where: { endDate: { gte: new Date() } },
        include: { role: { include: { project: { select: { id:true, name:true, client:true } } } } },
        orderBy: { startDate: 'desc' },
        take: 1,
      },
    },
    orderBy: { name: 'asc' },
  });
  res.json(resources);
});

// ── GET ONE ───────────────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  const r = await prisma.resource.findUnique({
    where: { id: req.params.id },
    include: {
      primarySkill: true,
      secondarySkills: { include: { skill: true } },
      costHistory: { orderBy: { effectiveDate: 'desc' } },
      deployments: {
        include: {
          role: { include: { project: { select: { id:true, name:true, client:true, status:true } } } },
          actuals: { orderBy: { month: 'desc' } },
        },
        orderBy: { startDate: 'desc' },
      },
    },
  });
  if (!r) return res.status(404).json({ error: 'Not found' });
  res.json(r);
});

// ── CREATE ────────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const {
      firstName, lastName,
      empId, email, phone,
      location, employmentType,
      joiningDate, contractStart, contractEnd,
      noticePeriod, rolloffDate,
      visaType, visaExpiry, bgCheckStatus,
      primarySkillId, primarySubmods,
      secondarySkillIds,
      costInput, rateCurrency, paymentTerms, payCurrency,
      status, benchSince,
    } = req.body;

    // Build full name from firstName + lastName
    const name = [firstName, lastName].filter(Boolean).join(' ').trim();
    if (!name)          return res.status(400).json({ error: 'Name is required' });
    if (!primarySkillId) return res.status(400).json({ error: 'Primary skill is required' });

    // For onsite resources, cost is USD; for offshore it's INR
    const effectiveRateCurrency = location === 'ONSITE' ? 'USD' : (rateCurrency || 'INR');

    const resource = await prisma.resource.create({
      data: {
        name,
        empId:          empId         || null,
        email:          email         || null,
        phone:          phone         || null,
        location:       location      || 'OFFSHORE',
        employmentType: employmentType || 'CONTRACTOR',
        joiningDate:    joiningDate   ? new Date(joiningDate)   : null,
        contractStart:  contractStart ? new Date(contractStart) : null,
        contractEnd:    contractEnd   ? new Date(contractEnd)   : null,
        noticePeriod:   noticePeriod  ? parseInt(noticePeriod)  : null,
        rolloffDate:    rolloffDate   ? new Date(rolloffDate)   : null,
        visaType:       visaType      || null,
        visaExpiry:     visaExpiry    ? new Date(visaExpiry)    : null,
        bgCheckStatus:  bgCheckStatus || 'NOT_REQUIRED',
        primarySkillId,
        primarySubmods: primarySubmods || [],
        costInput:      parseFloat(costInput) || 0,
        rateCurrency:   effectiveRateCurrency,
        paymentTerms:   paymentTerms  || 'Monthly',
        payCurrency:    payCurrency   || (location === 'ONSITE' ? 'USD' : 'INR'),
        status:         status        || 'AVAILABLE',
        benchSince:     benchSince    ? new Date(benchSince)    : null,
        secondarySkills: secondarySkillIds?.length
          ? { create: secondarySkillIds.map(sid => ({ skillId: sid })) }
          : undefined,
      },
      include: { primarySkill: true, secondarySkills: { include: { skill: true } } },
    });

    // Log cost history entry
    if (costInput) {
      await prisma.costHistory.create({
        data: {
          resourceId:    resource.id,
          costInput:     parseFloat(costInput),
          rateCurrency:  effectiveRateCurrency,
          effectiveDate: new Date(),
          notes:         'Initial rate on creation',
        },
      }).catch(() => {});
    }

    res.status(201).json(resource);
  } catch (e) {
    console.error('Resource create error:', e);
    res.status(400).json({ error: e.message });
  }
});

// ── UPDATE ────────────────────────────────────────────────────────────────────
router.patch('/:id', async (req, res) => {
  try {
    const {
      firstName, lastName, name: fullName,
      empId, email, phone,
      location, employmentType,
      joiningDate, contractStart, contractEnd,
      noticePeriod, rolloffDate,
      visaType, visaExpiry, bgCheckStatus,
      primarySkillId, primarySubmods,
      secondarySkillIds,
      costInput, rateCurrency, paymentTerms, payCurrency,
      status, benchSince,
    } = req.body;

    // Support both "name" (legacy) and "firstName"+"lastName"
    let name;
    if (firstName !== undefined || lastName !== undefined) {
      name = [firstName, lastName].filter(Boolean).join(' ').trim() || undefined;
    } else if (fullName !== undefined) {
      name = fullName;
    }

    const existing = await prisma.resource.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const effectiveLocation = location ?? existing.location;
    const effectiveRateCurrency = effectiveLocation === 'ONSITE'
      ? 'USD'
      : (rateCurrency ?? existing.rateCurrency ?? 'INR');

    const data = {};
    if (name              !== undefined) data.name             = name;
    if (empId             !== undefined) data.empId            = empId || null;
    if (email             !== undefined) data.email            = email || null;
    if (phone             !== undefined) data.phone            = phone || null;
    if (location          !== undefined) data.location         = location;
    if (employmentType    !== undefined) data.employmentType   = employmentType;
    if (joiningDate       !== undefined) data.joiningDate      = joiningDate   ? new Date(joiningDate)   : null;
    if (contractStart     !== undefined) data.contractStart    = contractStart ? new Date(contractStart) : null;
    if (contractEnd       !== undefined) data.contractEnd      = contractEnd   ? new Date(contractEnd)   : null;
    if (noticePeriod      !== undefined) data.noticePeriod     = noticePeriod  ? parseInt(noticePeriod)  : null;
    if (rolloffDate       !== undefined) data.rolloffDate      = rolloffDate   ? new Date(rolloffDate)   : null;
    if (visaType          !== undefined) data.visaType         = visaType      || null;
    if (visaExpiry        !== undefined) data.visaExpiry       = visaExpiry    ? new Date(visaExpiry)    : null;
    if (bgCheckStatus     !== undefined) data.bgCheckStatus    = bgCheckStatus;
    if (primarySkillId    !== undefined) data.primarySkillId   = primarySkillId;
    if (primarySubmods    !== undefined) data.primarySubmods   = primarySubmods;
    if (paymentTerms      !== undefined) data.paymentTerms     = paymentTerms;
    if (payCurrency       !== undefined) data.payCurrency      = payCurrency;
    if (status            !== undefined) data.status           = status;
    if (benchSince        !== undefined) data.benchSince       = benchSince ? new Date(benchSince) : null;

    if (costInput !== undefined) {
      data.costInput    = parseFloat(costInput);
      data.rateCurrency = effectiveRateCurrency;

      // Only log cost history if rate changed
      if (parseFloat(costInput) !== existing.costInput) {
        await prisma.costHistory.create({
          data: {
            resourceId:    req.params.id,
            costInput:     parseFloat(costInput),
            rateCurrency:  effectiveRateCurrency,
            effectiveDate: new Date(),
            notes:         'Rate updated',
          },
        }).catch(() => {});
      }
    }

    if (secondarySkillIds !== undefined) {
      await prisma.resourceSkill.deleteMany({ where: { resourceId: req.params.id } });
      if (secondarySkillIds.length) {
        data.secondarySkills = {
          create: secondarySkillIds.map(sid => ({ skillId: sid })),
        };
      }
    }

    const updated = await prisma.resource.update({
      where: { id: req.params.id },
      data,
      include: { primarySkill: true, secondarySkills: { include: { skill: true } } },
    });
    res.json(updated);
  } catch (e) {
    console.error('Resource update error:', e);
    res.status(400).json({ error: e.message });
  }
});

// ── STATUS CHANGE (dedicated endpoint) ───────────────────────────────────────
router.patch('/:id/status', async (req, res) => {
  try {
    const { status, benchSince } = req.body;
    if (!status) return res.status(400).json({ error: 'Status is required' });

    const data = { status };
    if (status === 'ON_BENCH' || status === 'AVAILABLE') {
      data.benchSince = benchSince ? new Date(benchSince) : new Date();
    }
    if (status === 'DEPLOYED' || status === 'PARTIALLY_DEPLOYED') {
      data.benchSince = null;
    }

    const updated = await prisma.resource.update({
      where: { id: req.params.id },
      data,
      include: { primarySkill: true },
    });
    res.json(updated);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
